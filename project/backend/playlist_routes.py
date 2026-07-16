from flask import Blueprint, session, jsonify
import requests
import spotipy
import config
import models
from datetime import datetime, timedelta

playlist_bp = Blueprint("playlists", __name__)


def _require_auth():
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"error": "Not authenticated"}), 401)
    return uid, None


def _get_valid_token(user_id):
    conn = models.get_db()
    row = conn.execute(
        "SELECT access_token, refresh_token, expires_at FROM spotify_tokens WHERE user_id = ?",
        (user_id,)
    ).fetchone()

    if not row:
        conn.close()
        return None

    expires_at = datetime.fromisoformat(row["expires_at"])
    if datetime.utcnow() >= expires_at:
        # Refresh
        resp = requests.post("https://accounts.spotify.com/api/token", data={
            "grant_type": "refresh_token",
            "refresh_token": row["refresh_token"],
            "client_id": config.SPOTIFY_CLIENT_ID,
            "client_secret": config.SPOTIFY_CLIENT_SECRET,
        })
        if resp.status_code == 200:
            tokens = resp.json()
            new_access = tokens["access_token"]
            expires_in = tokens.get("expires_in", 3600)
            new_expires = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
            conn.execute(
                "UPDATE spotify_tokens SET access_token = ?, expires_at = ? WHERE user_id = ?",
                (new_access, new_expires, user_id)
            )
            conn.commit()
            conn.close()
            return new_access

        conn.close()
        return None

    conn.close()
    return row["access_token"]


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

    token = _get_valid_token(uid)
    if not token:
        return jsonify({"error": "Spotify not connected. Please connect your Spotify account first."}), 400

    sp = spotipy.Spotify(auth=token)
    conn = models.get_db()

    imported_count = 0

    try:
        # Fetch user's playlists
        playlists_data = sp.current_user_playlists(limit=50)
        for pl in playlists_data["items"]:
            spotify_pl_id = pl["id"]
            name = pl["name"]
            description = pl.get("description") or ""
            image_url = pl["images"][0]["url"] if pl.get("images") else None
            track_count = pl["tracks"]["total"] if pl["tracks"] else 0

            # Insert or ignore playlist
            conn.execute("""
                INSERT OR IGNORE INTO playlists (user_id, spotify_playlist_id, name, description, image_url, track_count)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (uid, spotify_pl_id, name, description, image_url, track_count))

            playlist_row = conn.execute(
                "SELECT id FROM playlists WHERE user_id = ? AND spotify_playlist_id = ?",
                (uid, spotify_pl_id)
            ).fetchone()
            if not playlist_row:
                continue
            playlist_id = playlist_row["id"]

            # Fetch tracks for this playlist
            tracks_data = sp.playlist_tracks(spotify_pl_id, limit=100, fields="items(track(id,name,artists,album))")
            batch_track_ids = []
            for item in tracks_data.get("items", []):
                t = item.get("track")
                if not t or not t.get("id"):
                    continue

                spotify_tid = t["id"]
                name = t.get("name", "")
                artist = t["artists"][0]["name"] if t.get("artists") else ""
                album = t.get("album", {}).get("name", "") if t.get("album") else ""
                track_img = t["album"]["images"][0]["url"] if t.get("album", {}).get("images") else None

                conn.execute("""
                    INSERT OR IGNORE INTO tracks (spotify_track_id, name, artist, album, image_url)
                    VALUES (?, ?, ?, ?, ?)
                """, (spotify_tid, name, artist, album, track_img))

                track_row = conn.execute(
                    "SELECT id FROM tracks WHERE spotify_track_id = ?", (spotify_tid,)
                ).fetchone()
                if track_row:
                    # Link to playlist
                    conn.execute("""
                        INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id)
                        VALUES (?, ?)
                    """, (playlist_id, track_row["id"]))
                    batch_track_ids.append(spotify_tid)
                    imported_count += 1

            # Fetch audio features in batches of 100
            while batch_track_ids:
                batch = batch_track_ids[:100]
                batch_track_ids = batch_track_ids[100:]
                try:
                    features = sp.audio_features(batch)
                    for f in features:
                        if not f:
                            continue
                        conn.execute("""
                            UPDATE tracks SET
                                energy = ?, valence = ?, tempo = ?, danceability = ?,
                                acousticness = ?, instrumentalness = ?, key = ?, mode = ?,
                                fetched_at = CURRENT_TIMESTAMP
                            WHERE spotify_track_id = ?
                        """, (
                            f.get("energy"), f.get("valence"), f.get("tempo"),
                            f.get("danceability"), f.get("acousticness"),
                            f.get("instrumentalness"), f.get("key"), f.get("mode"),
                            f["id"]
                        ))
                except Exception:
                    pass  # Audio features may fail for some tracks — skip gracefully

            conn.commit()

    except Exception as e:
        conn.close()
        return jsonify({"error": f"Import failed: {str(e)}"}), 500

    # Fetch updated playlist list
    rows = conn.execute(
        "SELECT id, name, description, image_url, track_count, imported_at FROM playlists WHERE user_id = ? ORDER BY imported_at DESC",
        (uid,)
    ).fetchall()
    conn.close()

    return jsonify({
        "imported": imported_count,
        "playlists": [dict(r) for r in rows]
    })
