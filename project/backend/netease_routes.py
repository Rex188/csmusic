import requests
from flask import Blueprint, request, session, jsonify
import config
import models

NCM_API = config.NCM_API
netease_bp = Blueprint("netease", __name__)


def _require_auth():
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"error": "Not authenticated"}), 401)
    return uid, None


def _proxy(path, params=None, method="GET"):
    """Call the Netease API server and return raw JSON response."""
    url = f"{NCM_API}{path}"
    try:
        if method == "GET":
            resp = requests.get(url, params=params, timeout=15)
        else:
            resp = requests.post(url, data=params, timeout=15)
        return resp.json()
    except requests.exceptions.ConnectionError:
        return {"code": -1, "error": "Netease API server not running on port 3000"}
    except Exception as e:
        return {"code": -1, "error": str(e)}


def _unwrap(raw):
    """api-enhanced wraps in 'body' or 'data' — recursively unwrap to the inner payload."""
    inner = raw.get("body") or raw.get("data") or raw
    # Some endpoints double-wrap, e.g. {code: 200, body: {code: 200, data: {...}}}
    if isinstance(inner, dict) and (inner.get("body") or inner.get("data")):
        inner = inner.get("body") or inner.get("data")
    return inner


@netease_bp.route("/qr/key", methods=["GET"])
def qr_key():
    """Step 1: Get a key for QR login."""
    raw = _proxy("/login/qr/key")
    return jsonify(raw.get("body", raw))


@netease_bp.route("/qr/create", methods=["GET"])
def qr_create():
    """Step 2: Create a QR code image from a key."""
    key = request.args.get("key")
    if not key:
        return jsonify({"error": "key required"}), 400
    raw = _proxy("/login/qr/create", {"key": key, "qrimg": "1"})
    return jsonify(raw.get("body", raw))


@netease_bp.route("/qr/check", methods=["GET"])
def qr_check():
    """Step 3: Poll to check if QR code was scanned."""
    key = request.args.get("key")
    if not key:
        return jsonify({"error": "key required"}), 400
    raw = _proxy("/login/qr/check", {"key": key})
    body = _unwrap(raw)
    code = body.get("code")
    if code == 803:
        return jsonify({"code": 803, "cookie": body.get("cookie", "")})
    if code == 800:
        return jsonify({"code": 800, "message": "QR code expired"})
    if code == 802:
        return jsonify({"code": 802, "message": "Scanning, confirm on phone"})
    return jsonify({"code": 801, "message": "Waiting for scan"})


@netease_bp.route("/connect", methods=["POST"])
def connect():
    """Save Netease cookie from QR login and fetch user info."""
    uid, err = _require_auth()
    if err:
        return err

    data = request.get_json(silent=True)
    if not data or not data.get("cookie"):
        return jsonify({"error": "cookie required"}), 400

    cookie = data["cookie"]

    # Fetch user info from Netease
    try:
        info_resp = requests.get(f"{NCM_API}/login/status", params={"cookie": cookie}, timeout=10)
        info = info_resp.json().get("body") or info_resp.json()
        profile = info.get("data", {}).get("profile", {})
        netease_user_id = str(profile.get("userId", ""))
        netease_nickname = profile.get("nickname", "")
        netease_avatar = profile.get("avatarUrl", "")
    except Exception:
        netease_user_id = ""
        netease_nickname = ""
        netease_avatar = ""

    conn = models.get_db()
    conn.execute("""
        INSERT INTO netease_tokens (user_id, cookie, netease_user_id, netease_nickname, netease_avatar)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            cookie = excluded.cookie,
            netease_user_id = excluded.netease_user_id,
            netease_nickname = excluded.netease_nickname,
            netease_avatar = excluded.netease_avatar,
            updated_at = CURRENT_TIMESTAMP
    """, (uid, cookie, netease_user_id, netease_nickname, netease_avatar))
    conn.commit()
    conn.close()

    return jsonify({
        "connected": True,
        "nickname": netease_nickname or "Netease User",
        "netease_user_id": netease_user_id
    })


@netease_bp.route("/status", methods=["GET"])
def status():
    uid, err = _require_auth()
    if err:
        return err

    conn = models.get_db()
    row = conn.execute(
        "SELECT netease_user_id, netease_nickname, netease_avatar FROM netease_tokens WHERE user_id = ?",
        (uid,)
    ).fetchone()
    conn.close()

    if row:
        return jsonify({
            "connected": True,
            "nickname": row["netease_nickname"],
            "netease_user_id": row["netease_user_id"],
            "avatar": row["netease_avatar"]
        })
    return jsonify({"connected": False})


@netease_bp.route("/disconnect", methods=["POST"])
def disconnect():
    uid, err = _require_auth()
    if err:
        return err

    conn = models.get_db()
    conn.execute("DELETE FROM netease_tokens WHERE user_id = ?", (uid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})
