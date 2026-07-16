from flask import Flask, jsonify, session
from flask_cors import CORS
import config
from models import init_db

app = Flask(__name__)
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


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
