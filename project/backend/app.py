import os
from flask import Flask, jsonify, session, send_from_directory
from flask_cors import CORS
import config
from models import init_db

app = Flask(__name__, static_folder=None)
app.secret_key = config.SECRET_KEY
CORS(app, supports_credentials=True, origins=["http://localhost:5173"])

from auth import auth_bp
from netease_routes import netease_bp
from playlist_routes import playlist_bp

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(netease_bp, url_prefix="/api/netease")
app.register_blueprint(playlist_bp, url_prefix="/api/playlists")


@app.route("/api/me")
def me():
    """Standalone /api/me — the frontend calls this directly."""
    uid = session.get("user_id")
    if not uid:
        return jsonify({"user": None}), 401
    import models
    conn = models.get_db()
    row = conn.execute("SELECT id, email FROM users WHERE id = ?", (uid,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"user": None}), 401
    return jsonify({"user": {"id": row["id"], "email": row["email"]}})


# --- Serve built React frontend in production ---
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if not os.path.isdir(FRONTEND_DIR):
        return jsonify({"error": "Frontend not built. Run `cd frontend && npm run build` first."}), 500
    file_path = os.path.join(FRONTEND_DIR, path)
    if path and os.path.isfile(file_path):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, "index.html")


if __name__ == "__main__":
    init_db()
    is_dev = os.getenv("RENDER") is None
    app.run(debug=is_dev, port=5000)
