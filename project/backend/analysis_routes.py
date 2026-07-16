import json
import requests
from flask import Blueprint, session, jsonify
import config
import models

NCM_API = config.NCM_API
analysis_bp = Blueprint("analysis", __name__)


def _require_auth():
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"error": "Not authenticated"}), 401)
    return uid, None


def _get_cookie(user_id):
    conn = models.get_db()
    row = conn.execute(
        "SELECT cookie FROM netease_tokens WHERE user_id = ?",
        (user_id,)
    ).fetchone()
    conn.close()
    return row["cookie"] if row else None


def _call_ncm(path, params=None, timeout=60):
    """Call the Netease API server."""
    url = f"{NCM_API}{path}"
    try:
        resp = requests.get(url, params=params, timeout=timeout)
        return resp.json()
    except requests.exceptions.ConnectionError:
        return {"code": -1, "error": "Netease API server not running"}
    except Exception as e:
        return {"code": -1, "error": str(e)}


def _unwrap(raw):
    """api-enhanced wraps in 'body' or 'data' — recursively unwrap."""
    inner = raw.get("body") or raw.get("data") or raw
    if isinstance(inner, dict) and (inner.get("body") or inner.get("data")):
        inner = inner.get("body") or inner.get("data")
    return inner


def _get_tracks_for_playlist(playlist_db_id):
    """Get all tracks for a playlist from the local DB."""
    conn = models.get_db()
    rows = conn.execute("""
        SELECT t.id, t.netease_track_id, t.name, t.artist, t.album, t.image_url, t.duration
        FROM tracks t
        JOIN playlist_tracks pt ON pt.track_id = t.id
        WHERE pt.playlist_id = ?
        ORDER BY pt.added_at
    """, (playlist_db_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Routes ───────────────────────────────────────────────────────────

@analysis_bp.route("/tracks/<int:playlist_id>", methods=["GET"])
def get_tracks(playlist_id):
    """Return all tracks for a given playlist (only if it belongs to the user)."""
    uid, err = _require_auth()
    if err:
        return err

    conn = models.get_db()
    pl = conn.execute(
        "SELECT id, name FROM playlists WHERE id = ? AND user_id = ?",
        (playlist_id, uid)
    ).fetchone()
    if not pl:
        conn.close()
        return jsonify({"error": "Playlist not found"}), 404

    tracks = _get_tracks_for_playlist(playlist_id)
    conn.close()

    return jsonify({
        "playlist": {"id": pl["id"], "name": pl["name"]},
        "tracks": tracks,
        "total": len(tracks)
    })


@analysis_bp.route("/analyze/<int:playlist_id>", methods=["POST"])
def analyze_playlist(playlist_id):
    """
    Start (or retrieve) analysis for a playlist.
    For now, this is a stub that:
      1. Verifies auth + playlist ownership
      2. Gets all tracks from the local DB
      3. Checks audio availability via Netease API
      4. Creates an analysis_job record
      5. Returns a summary
    """
    uid, err = _require_auth()
    if err:
        return err

    # Verify playlist belongs to user
    conn = models.get_db()
    pl = conn.execute(
        "SELECT id, name, track_count FROM playlists WHERE id = ? AND user_id = ?",
        (playlist_id, uid)
    ).fetchone()
    if not pl:
        conn.close()
        return jsonify({"error": "Playlist not found"}), 404

    # Check if there's an existing analysis job (don't re-run)
    existing = conn.execute(
        "SELECT id, status, summary, created_at, completed_at FROM analysis_jobs "
        "WHERE playlist_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1",
        (playlist_id, uid)
    ).fetchone()
    if existing and existing["status"] == "completed":
        conn.close()
        return jsonify({
            "job_id": existing["id"],
            "status": "completed",
            "message": "Already analyzed. Use GET /api/analysis/status/<job_id> for details.",
            "summary": json.loads(existing["summary"]) if existing["summary"] else None
        })

    # Get tracks from local DB
    tracks = _get_tracks_for_playlist(playlist_id)

    if not tracks:
        conn.close()
        return jsonify({"error": "No tracks found for this playlist. Import playlists first."}), 400

    # Create analysis job
    conn.execute(
        "INSERT INTO analysis_jobs (user_id, playlist_id, status) VALUES (?, ?, 'analyzing')",
        (uid, playlist_id)
    )
    conn.commit()
    # Fetch the job we just created
    job_row = conn.execute(
        "SELECT id FROM analysis_jobs WHERE user_id = ? AND playlist_id = ? AND status = 'analyzing' "
        "ORDER BY created_at DESC LIMIT 1",
        (uid, playlist_id)
    ).fetchone()
    job_id = job_row["id"]

    # Try to check audio availability via Netease API (batched — single request)
    cookie = _get_cookie(uid)
    total = len(tracks)
    accessible = 0
    audio_sample = None

    if cookie:
        try:
            # Batch ALL track IDs into a single /song/url request (API supports comma-separated)
            all_ids = ",".join(t["netease_track_id"] for t in tracks)
            url_data = _call_ncm("/song/url", {"id": all_ids, "cookie": cookie}, timeout=30)
            inner = _unwrap(url_data)
            songs = inner.get("data", []) if isinstance(inner, dict) else []
            for song in songs:
                if song and song.get("url"):
                    accessible += 1
                    if not audio_sample:
                        audio_sample = {"track_id": song.get("id"), "name": song.get("name", "?"), "url": song["url"]}
        except Exception as e:
            print(f"[analysis] audio check failed (non-fatal): {e}")

    summary = {
        "total_tracks": total,
        "accessible_tracks": accessible,
        "playlist_name": pl["name"],
        "track_count_estimate": pl["track_count"],
        "audio_sample": audio_sample
    }

    conn.execute(
        "UPDATE analysis_jobs SET status = 'completed', summary = ? WHERE id = ?",
        (json.dumps(summary), job_id)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "job_id": job_id,
        "status": "completed",
        "summary": summary,
        "message": (
            f"Pre-analysis complete. {accessible}/{total} tracks have accessible audio. "
            "Full librosa analysis coming soon."
        )
    })


@analysis_bp.route("/status/<int:job_id>", methods=["GET"])
def get_analysis_status(job_id):
    """Get the status and results of an analysis job."""
    uid, err = _require_auth()
    if err:
        return err

    conn = models.get_db()
    job = conn.execute(
        "SELECT id, playlist_id, status, summary, created_at, completed_at "
        "FROM analysis_jobs WHERE id = ? AND user_id = ?",
        (job_id, uid)
    ).fetchone()
    conn.close()

    if not job:
        return jsonify({"error": "Analysis job not found"}), 404

    return jsonify({
        "job_id": job["id"],
        "playlist_id": job["playlist_id"],
        "status": job["status"],
        "summary": json.loads(job["summary"]) if job["summary"] else None,
        "created_at": job["created_at"],
        "completed_at": job["completed_at"]
    })
