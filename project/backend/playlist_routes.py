import requests
from flask import Blueprint, session, jsonify
import models

NCM_API = "http://localhost:3000"
playlist_bp = Blueprint("playlists", __name__)


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


def _call_ncm(path, params=None):
    """Call the Netease API server with cookie injection."""
    url = f"{NCM_API}{path}"
    try:
        resp = requests.get(url, params=params, timeout=15)
        return resp.json()
    except requests.exceptions.ConnectionError:
        return {"code": -1, "error": "Netease API server not running"}
    except Exception as e:
        return {"code": -1, "error": str(e)}


@playlist_bp.route("", methods=["GET"])
def list_playlists():
    uid, err = _require_auth()
    if err:
        return err

    conn = models.get_db()
    rows = conn.execute(
        "SELECT id, name, description, image_url, track_count, imported_at FROM playlists WHERE user_id = ? ORDER BY imported_at DESC",
        (uid,)
    ).fetchall()
    conn.close()

    return jsonify({
        "playlists": [dict(r) for r in rows]
    })


@playlist_bp.route("/import", methods=["POST"])
def import_playlists():
    uid, err = _require_auth()
    if err:
        return err

    cookie = _get_cookie(uid)
    if not cookie:
        return jsonify({"error": "Netease not connected. Please login via QR code first."}), 400

    # Step 1: Get user info to find Netease UID
    info_resp = _call_ncm("/login/status", {"cookie": cookie})
    info = info_resp.get("body") or info_resp
    profile = info.get("data", {}).get("profile", {})
    netease_uid = profile.get("userId")

    if not netease_uid:
        # Try getting from tokens table
        conn = models.get_db()
        row = conn.execute(
            "SELECT netease_user_id FROM netease_tokens WHERE user_id = ?", (uid,)
        ).fetchone()
        conn.close()
        netease_uid = row["netease_user_id"] if row else None
        if not netease_uid:
            return jsonify({"error": "Could not find Netease user ID. Try reconnecting."}), 400

    # Step 2: Fetch user's playlists from Netease
    pl_data = _call_ncm("/user/playlist", {"uid": netease_uid, "limit": 50, "cookie": cookie})
    playlist_list = pl_data.get("playlist") if "playlist" in pl_data else pl_data.get("body", {}).get("playlist", [])

    if not playlist_list:
        return jsonify({"error": "No playlists found or API error", "raw": pl_data}), 500

    conn = models.get_db()
    imported_count = 0

    for pl in playlist_list:
        pl_id = str(pl["id"])
        name = pl.get("name", "")
        desc = pl.get("description") or ""
        img_url = pl.get("coverImgUrl") or (pl.get("picUrl") or None)
        track_count = pl.get("trackCount", 0)

        # Insert playlist
        conn.execute("""
            INSERT OR IGNORE INTO playlists (user_id, netease_playlist_id, name, description, image_url, track_count)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (uid, pl_id, name, desc, img_url, track_count))

        playlist_row = conn.execute(
            "SELECT id FROM playlists WHERE user_id = ? AND netease_playlist_id = ?",
            (uid, pl_id)
        ).fetchone()
        if not playlist_row:
            continue
        playlist_db_id = playlist_row["id"]

        # Step 3: Fetch tracks for this playlist
        track_data = _call_ncm("/playlist/track/all", {
            "id": pl_id, "limit": 100, "cookie": cookie
        })

        songs = track_data.get("songs") if "songs" in track_data else track_data.get("body", {}).get("songs", [])
        if not songs:
            songs = track_data.get("body", {}).get("songs", [])

        for song in songs:
            song_id = str(song.get("id"))
            if not song_id:
                continue
            song_name = song.get("name", "")
            artists = ", ".join(a.get("name", "") for a in song.get("ar", song.get("artists", [])))
            album_name = ""
            album_img = None
            album_info = song.get("al") or song.get("album", {})
            if album_info:
                album_name = album_info.get("name", "")
                album_img = album_info.get("picUrl") or None
            duration = song.get("dt", song.get("duration", 0))

            conn.execute("""
                INSERT OR IGNORE INTO tracks (netease_track_id, name, artist, album, image_url, duration)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (song_id, song_name, artists, album_name, album_img, duration))

            track_row = conn.execute(
                "SELECT id FROM tracks WHERE netease_track_id = ?", (song_id,)
            ).fetchone()
            if track_row:
                conn.execute("""
                    INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id)
                    VALUES (?, ?)
                """, (playlist_db_id, track_row["id"]))
                imported_count += 1

        conn.commit()

    # Fetch updated list
    rows = conn.execute(
        "SELECT id, name, description, image_url, track_count, imported_at FROM playlists WHERE user_id = ? ORDER BY imported_at DESC",
        (uid,)
    ).fetchall()
    conn.close()

    return jsonify({
        "imported": imported_count,
        "playlists": [dict(r) for r in rows]
    })
