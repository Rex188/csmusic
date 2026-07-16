from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from flask import Blueprint, session, jsonify
import config
import models

NCM_API = config.NCM_API
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
    """api-enhanced wraps in 'body' or 'data' — recursively unwrap to the inner payload."""
    inner = raw.get("body") or raw.get("data") or raw
    if isinstance(inner, dict) and (inner.get("body") or inner.get("data")):
        inner = inner.get("body") or inner.get("data")
    return inner


def _fetch_tracks(pl_id, cookie):
    """Fetch tracks for one playlist (runs in parallel)."""
    data = _call_ncm("/playlist/track/all", {"id": pl_id, "limit": 100, "cookie": cookie}, timeout=120)
    inner = _unwrap(data)
    return pl_id, inner.get("songs", [])


def _insert_tracks(conn, playlist_db_id, songs):
    """Insert songs into DB for a single playlist. Returns count."""
    count = 0
    for song in songs:
        song_id = str(song.get("id"))
        if not song_id:
            continue
        song_name = song.get("name", "")
        raw_artists = song.get("ar", song.get("artists", []))
        artists = ", ".join(a.get("name") or "" for a in raw_artists)
        album_info = song.get("al") or song.get("album", {})
        album_name = album_info.get("name", "") if album_info else ""
        album_img = album_info.get("picUrl") or None if album_info else None
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
            count += 1
    return count


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
    info = _unwrap(info_resp)
    profile = info.get("data", {}).get("profile", {})
    netease_uid = profile.get("userId")

    if not netease_uid:
        conn = models.get_db()
        row = conn.execute(
            "SELECT netease_user_id FROM netease_tokens WHERE user_id = ?", (uid,)
        ).fetchone()
        conn.close()
        netease_uid = row["netease_user_id"] if row else None
        if not netease_uid:
            return jsonify({"error": "Could not find Netease user ID. Try reconnecting."}), 400

    # Step 2: Fetch user's playlists from Netease
    pl_data = _call_ncm("/user/playlist", {"uid": netease_uid, "limit": 50, "cookie": cookie}, timeout=120)
    pl_inner = _unwrap(pl_data)
    playlist_list = pl_inner.get("playlist", [])

    if not playlist_list:
        return jsonify({"error": "No playlists found or API error", "raw": pl_data}), 500

    conn = models.get_db()
    imported_count = 0
    playlist_meta = []  # (playlist_db_id, pl_id) pairs for parallel fetching

    for pl in playlist_list:
        pl_id = str(pl["id"])
        name = pl.get("name", "")
        desc = pl.get("description") or ""
        img_url = pl.get("coverImgUrl") or (pl.get("picUrl") or None)
        track_count = pl.get("trackCount", 0)

        conn.execute("""
            INSERT OR IGNORE INTO playlists (user_id, netease_playlist_id, name, description, image_url, track_count)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (uid, pl_id, name, desc, img_url, track_count))

        playlist_row = conn.execute(
            "SELECT id FROM playlists WHERE user_id = ? AND netease_playlist_id = ?",
            (uid, pl_id)
        ).fetchone()
        if playlist_row:
            playlist_meta.append((playlist_row["id"], pl_id))

    conn.commit()

    # Step 3: Fetch ALL playlists' tracks in parallel
    # Use a dedicated session for thread safety
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_map = {
            executor.submit(_fetch_tracks, pl_id, cookie): db_id
            for db_id, pl_id in playlist_meta
        }

        for future in as_completed(future_map):
            playlist_db_id = future_map[future]
            try:
                _, songs = future.result()
                # Insert tracks into DB (sequential per playlist, but concurrent across playlists)
                imported_count += _insert_tracks(conn, playlist_db_id, songs)
                conn.commit()
            except Exception as e:
                print(f"[import] error for playlist {playlist_db_id}: {e}")

    conn.close()

    # Fetch updated list
    conn = models.get_db()
    rows = conn.execute(
        "SELECT id, name, description, image_url, track_count, imported_at FROM playlists WHERE user_id = ? ORDER BY imported_at DESC",
        (uid,)
    ).fetchall()
    conn.close()

    return jsonify({
        "imported": imported_count,
        "playlists": [dict(r) for r in rows]
    })
