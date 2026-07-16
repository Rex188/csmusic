import json
import random
import requests
from flask import Blueprint, session, jsonify
import config
import models

NCM_API = config.NCM_API
LLM_API_KEY = config.LLM_API_KEY
LLM_API_URL = config.LLM_API_URL
LLM_MODEL = config.LLM_MODEL

analysis_bp = Blueprint("analysis", __name__)


def _require_auth():
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"error": "Not authenticated"}), 401)
    return uid, None


def _get_tracks_for_playlist(playlist_db_id):
    """Get all tracks for a playlist from the local DB."""
    conn = models.get_db()
    rows = conn.execute("""
        SELECT t.id, t.netease_track_id, t.name, t.artist, t.album, t.image_url
        FROM tracks t
        JOIN playlist_tracks pt ON pt.track_id = t.id
        WHERE pt.playlist_id = ?
        ORDER BY pt.added_at
    """, (playlist_db_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _call_llm(system_prompt, user_prompt):
    """Call an OpenAI-compatible LLM API and return the response text."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {LLM_API_KEY}"
    }
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 2000
    }

    resp = requests.post(
        f"{LLM_API_URL.rstrip('/')}/chat/completions",
        headers=headers,
        json=payload,
        timeout=60
    )

    if resp.status_code != 200:
        key_preview = LLM_API_KEY[:6] + "..." if len(LLM_API_KEY) > 6 else "(empty)"
        raise Exception(
            f"LLM API returned {resp.status_code} (key={key_preview}, url={LLM_API_URL}, model={LLM_MODEL}): "
            f"{resp.text[:300]}"
        )

    data = resp.json()
    return data["choices"][0]["message"]["content"]


def _build_analysis_prompt(playlist_name, tracks, total_count, sampled_count):
    """Build the LLM prompt for playlist analysis."""
    track_lines = []
    for i, t in enumerate(tracks, 1):
        track_lines.append(f"{i}. \"{t['name']}\" — {t['artist']}" +
                           (f" ({t['album']})" if t.get('album') else ""))

    track_block = "\n".join(track_lines)

    return f"""Playlist: "{playlist_name}"
Total tracks: {total_count}
Sampled tracks for analysis: {sampled_count}

Tracks:
{track_block}"""


SYSTEM_PROMPT = """You are a music analysis AI. Analyze the given playlist and return ONLY valid JSON (no markdown, no explanation).

Extract deep musical and emotional patterns from the track list. Consider:
- Artist/genre signatures: recurring artists or stylistic groups
- Mood trajectory: the emotional arc across tracks
- Energy & tempo patterns: whether the playlist is consistent or varied
- Cultural/texture clues: languages, eras, production styles implied by artist/album names

Return this exact JSON structure:
{
  "vibe": "one-line description of the overall atmosphere",
  "mood_tags": ["3-5 mood keywords like energetic, melancholic, contemplative, upbeat, dark"],
  "energy": "low | medium-low | medium | medium-high | high",
  "valence": "sad | melancholic | neutral | happy | euphoric",
  "tempo_pace": "slow | moderate | upbeat | fast | varied",
  "primary_genres": ["2-4 most likely genres"],
  "standout_artists": ["artists that define this playlist's character"],
  "diversity": "very consistent | somewhat varied | highly diverse",
  "insight": "one short sentence about what this playlist reveals about the listener's taste",
  "sample_size": <number of tracks analyzed>,
  "total_tracks": <total tracks in playlist>
}"""


# ── Routes ──────────────────────────────────────────────────────────

@analysis_bp.route("/_diag", methods=["GET"])
def diag_llm():
    """Diagnostic: check LLM config and test the connection."""
    uid, err = _require_auth()
    if err:
        return err

    key_masked = (LLM_API_KEY[:8] + "****") if len(LLM_API_KEY) > 8 else "(empty)"
    result = {
        "config": {
            "LLM_API_URL": LLM_API_URL,
            "LLM_MODEL": LLM_MODEL,
            "LLM_API_KEY": key_masked,
            "key_length": len(LLM_API_KEY),
        }
    }

    if not LLM_API_KEY:
        result["error"] = "LLM_API_KEY is empty. Set it in Render Environment Variables."
        return jsonify(result)

    # Try a minimal call to DeepSeek API
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LLM_API_KEY}"
        }
        payload = {
            "model": LLM_MODEL,
            "messages": [{"role": "user", "content": "Say hi in 3 words."}],
            "max_tokens": 10
        }
        resp = requests.post(
            f"{LLM_API_URL.rstrip('/')}/chat/completions",
            headers=headers,
            json=payload,
            timeout=15
        )
        result["api_status"] = resp.status_code
        result["api_response"] = resp.text[:500]
    except Exception as e:
        result["api_error"] = str(e)

    return jsonify(result)

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
    Analyze a playlist via LLM.
    Samples up to N tracks, sends to LLM, returns structured analysis.
    """
    uid, err = _require_auth()
    if err:
        return err

    conn = models.get_db()
    pl = conn.execute(
        "SELECT id, name, track_count FROM playlists WHERE id = ? AND user_id = ?",
        (playlist_id, uid)
    ).fetchone()
    if not pl:
        conn.close()
        return jsonify({"error": "Playlist not found"}), 404

    # Check if there's an existing completed analysis
    existing = conn.execute(
        "SELECT id, status, summary FROM analysis_jobs "
        "WHERE playlist_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1",
        (playlist_id, uid)
    ).fetchone()

    if existing and existing["status"] == "completed" and existing["summary"]:
        conn.close()
        return jsonify({
            "job_id": existing["id"],
            "status": "completed",
            "analysis": json.loads(existing["summary"])
        })

    tracks = _get_tracks_for_playlist(playlist_id)
    if not tracks:
        conn.close()
        return jsonify({"error": "No tracks found. Import playlists first."}), 400

    total = len(tracks)

    # Create analysis job
    conn.execute(
        "INSERT INTO analysis_jobs (user_id, playlist_id, status) VALUES (?, ?, 'analyzing')",
        (uid, playlist_id)
    )
    conn.commit()
    job_row = conn.execute(
        "SELECT id FROM analysis_jobs WHERE user_id = ? AND playlist_id = ? AND status = 'analyzing' "
        "ORDER BY created_at DESC LIMIT 1",
        (uid, playlist_id)
    ).fetchone()
    job_id = job_row["id"]

    # Sample tracks for LLM (max 40 to keep prompt fast, shuffle for randomness)
    SAMPLE_MAX = 40
    if total <= SAMPLE_MAX:
        sampled = list(tracks)
    else:
        sampled = random.sample(tracks, SAMPLE_MAX)

    # Default summary (fallback if LLM is not configured or fails)
    summary = {
        "total_tracks": total,
        "sample_size": len(sampled),
        "vibe": "",
        "mood_tags": [],
        "energy": "",
        "valence": "",
        "tempo_pace": "",
        "primary_genres": [],
        "standout_artists": [],
        "diversity": "",
        "insight": ""
    }

    if not LLM_API_KEY:
        # LLM not configured — save basic info
        summary["vibe"] = "LLM not configured. Set LLM_API_KEY in .env to enable analysis."
    else:
        try:
            user_prompt = _build_analysis_prompt(
                pl["name"], sampled, total, len(sampled)
            )
            llm_text = _call_llm(SYSTEM_PROMPT, user_prompt)

            # Parse JSON from LLM response (handle possible markdown fences)
            llm_text = llm_text.strip()
            if llm_text.startswith("```"):
                llm_text = llm_text.split("\n", 1)[-1]
                if "```" in llm_text:
                    llm_text = llm_text.rsplit("```", 1)[0]
            llm_text = llm_text.strip()

            llm_result = json.loads(llm_text)
            summary.update({
                "vibe": llm_result.get("vibe", ""),
                "mood_tags": llm_result.get("mood_tags", []),
                "energy": llm_result.get("energy", ""),
                "valence": llm_result.get("valence", ""),
                "tempo_pace": llm_result.get("tempo_pace", ""),
                "primary_genres": llm_result.get("primary_genres", []),
                "standout_artists": llm_result.get("standout_artists", []),
                "diversity": llm_result.get("diversity", ""),
                "insight": llm_result.get("insight", ""),
            })
        except Exception as e:
            print(f"[analysis] LLM call failed: {e}")
            summary["vibe"] = f"Analysis failed: {str(e)[:100]}"

    conn.execute(
        "UPDATE analysis_jobs SET status = 'completed', summary = ? WHERE id = ?",
        (json.dumps(summary), job_id)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "job_id": job_id,
        "status": "completed",
        "analysis": summary
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
        "analysis": json.loads(job["summary"]) if job["summary"] else None,
        "created_at": job["created_at"],
        "completed_at": job["completed_at"]
    })
