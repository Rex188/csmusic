from flask import Blueprint, request, session, jsonify, redirect
import urllib.parse
import requests
import time
import config
import models
from datetime import datetime, timedelta

spotify_bp = Blueprint("spotify", __name__)


def _require_auth():
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"error": "Not authenticated"}), 401)
    return uid, None


@spotify_bp.route("/connect", methods=["GET"])
def connect():
    uid, err = _require_auth()
    if err:
        return err

    params = {
        "client_id": config.SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": config.SPOTIFY_REDIRECT_URI,
        "scope": "playlist-read-private playlist-read-collaborative",
        "state": str(uid),
    }
    url = "https://accounts.spotify.com/authorize?" + urllib.parse.urlencode(params)
    return jsonify({"url": url})


@spotify_bp.route("/callback", methods=["GET"])
def callback():
    code = request.args.get("code")
    state = request.args.get("state")

    if not code or not state:
        return "Missing code or state", 400

    # Exchange code for tokens
    resp = requests.post("https://accounts.spotify.com/api/token", data={
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": config.SPOTIFY_REDIRECT_URI,
        "client_id": config.SPOTIFY_CLIENT_ID,
        "client_secret": config.SPOTIFY_CLIENT_SECRET,
    })

    if resp.status_code != 200:
        return f"Token exchange failed: {resp.text}", 400

    tokens = resp.json()
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]
    expires_in = tokens["expires_in"]
    expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

    # Get Spotify user profile
    profile_resp = requests.get("https://api.spotify.com/v1/me", headers={
        "Authorization": f"Bearer {access_token}"
    })
    spotify_user = profile_resp.json() if profile_resp.status_code == 200 else {}
    spotify_user_id = spotify_user.get("id", "")
    spotify_display_name = spotify_user.get("display_name", "")

    # Upsert tokens
    conn = models.get_db()
    conn.execute("""
        INSERT INTO spotify_tokens (user_id, access_token, refresh_token, expires_at, spotify_user_id, spotify_display_name)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            expires_at = excluded.expires_at,
            spotify_user_id = excluded.spotify_user_id,
            spotify_display_name = excluded.spotify_display_name
    """, (state, access_token, refresh_token, expires_at.isoformat(), spotify_user_id, spotify_display_name))
    conn.commit()
    conn.close()

    return redirect("http://localhost:5173/dashboard")


@spotify_bp.route("/status", methods=["GET"])
def status():
    uid, err = _require_auth()
    if err:
        return err

    conn = models.get_db()
    row = conn.execute(
        "SELECT spotify_user_id, spotify_display_name FROM spotify_tokens WHERE user_id = ?",
        (uid,)
    ).fetchone()
    conn.close()

    if row:
        return jsonify({"connected": True, "display_name": row["spotify_display_name"], "spotify_user_id": row["spotify_user_id"]})
    return jsonify({"connected": False})
