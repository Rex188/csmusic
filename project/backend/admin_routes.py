import os
import json
from flask import Blueprint, request, session, jsonify
import models

admin_bp = Blueprint("admin", __name__)


def _require_admin():
    """Verify admin key from query param or request body."""
    key = request.args.get("key") or (request.get_json(silent=True) or {}).get("key")
    expected = os.getenv("ADMIN_KEY")
    if not expected or key != expected:
        return False
    return True


# ── Dashboard ───────────────────────────────────────────────────────

@admin_bp.route("", methods=["GET"])
def admin_dashboard():
    if not _require_admin():
        return jsonify({"error": "Unauthorized. Set ADMIN_KEY env var and pass ?key=..."}), 403

    conn = models.get_db()

    users = [dict(r) for r in conn.execute(
        "SELECT id, email, email_verified, created_at FROM users ORDER BY id"
    ).fetchall()]

    netease = [dict(r) for r in conn.execute("""
        SELECT u.email, nt.user_id, nt.netease_nickname, nt.netease_user_id, nt.updated_at
        FROM netease_tokens nt JOIN users u ON u.id = nt.user_id
    """).fetchall()]

    playlists = [dict(r) for r in conn.execute("""
        SELECT p.id, p.user_id, u.email, p.name, p.track_count, p.imported_at
        FROM playlists p JOIN users u ON u.id = p.user_id ORDER BY p.imported_at DESC
    """).fetchall()]

    track_count = conn.execute("SELECT COUNT(*) as c FROM tracks").fetchone()["c"]
    analysis_count = conn.execute("SELECT COUNT(*) as c FROM analysis_jobs").fetchone()["c"]

    conn.close()

    return jsonify({
        "stats": {
            "users": len(users),
            "netease_connected": len(netease),
            "playlists": len(playlists),
            "tracks": track_count,
            "analyses": analysis_count
        },
        "users": users,
        "netease": netease,
        "playlists": playlists,
    })


# ── Delete user (cascade) ───────────────────────────────────────────

@admin_bp.route("/user/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    if not _require_admin():
        return jsonify({"error": "Unauthorized"}), 403

    conn = models.get_db()
    user = conn.execute("SELECT id, email FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "User not found"}), 404

    email = user["email"]

    # Cascade delete: playlist_tracks → tracks, playlists, analysis_jobs, netease_tokens, users
    playlist_ids = conn.execute(
        "SELECT id FROM playlists WHERE user_id = ?", (user_id,)
    ).fetchall()

    for pl in playlist_ids:
        conn.execute("DELETE FROM playlist_tracks WHERE playlist_id = ?", (pl["id"],))
        conn.execute("DELETE FROM track_features WHERE analysis_job_id IN (SELECT id FROM analysis_jobs WHERE playlist_id = ?)", (pl["id"],))
        conn.execute("DELETE FROM analysis_jobs WHERE playlist_id = ?", (pl["id"],))

    # Delete orphan tracks (tracks not referenced by any playlist)
    conn.execute("""
        DELETE FROM tracks WHERE id NOT IN (SELECT track_id FROM playlist_tracks)
    """)

    conn.execute("DELETE FROM playlists WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM email_verifications WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM track_features WHERE analysis_job_id IN (SELECT id FROM analysis_jobs WHERE user_id = ?)", (user_id,))
    conn.execute("DELETE FROM analysis_jobs WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM netease_tokens WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "deleted_user": email})


# ── Delete playlist ─────────────────────────────────────────────────

@admin_bp.route("/playlist/<int:playlist_id>", methods=["DELETE"])
def delete_playlist(playlist_id):
    if not _require_admin():
        return jsonify({"error": "Unauthorized"}), 403

    conn = models.get_db()
    pl = conn.execute(
        "SELECT id, name FROM playlists WHERE id = ?", (playlist_id,)
    ).fetchone()
    if not pl:
        conn.close()
        return jsonify({"error": "Playlist not found"}), 404

    name = pl["name"]
    conn.execute("DELETE FROM playlist_tracks WHERE playlist_id = ?", (playlist_id,))
    conn.execute("DELETE FROM track_features WHERE analysis_job_id IN (SELECT id FROM analysis_jobs WHERE playlist_id = ?)", (playlist_id,))
    conn.execute("DELETE FROM analysis_jobs WHERE playlist_id = ?", (playlist_id,))
    conn.execute("DELETE FROM playlists WHERE id = ?", (playlist_id,))

    # Clean up orphan tracks
    conn.execute("""
        DELETE FROM tracks WHERE id NOT IN (SELECT track_id FROM playlist_tracks)
    """)
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "deleted_playlist": name})


# ── Disconnect Netease ──────────────────────────────────────────────

@admin_bp.route("/disconnect/<int:user_id>", methods=["POST"])
def disconnect_netease(user_id):
    if not _require_admin():
        return jsonify({"error": "Unauthorized"}), 403

    conn = models.get_db()
    row = conn.execute(
        "SELECT netease_nickname FROM netease_tokens WHERE user_id = ?", (user_id,)
    ).fetchone()
    nickname = row["netease_nickname"] if row else None

    conn.execute("DELETE FROM netease_tokens WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "disconnected": nickname or f"user {user_id}"})
