from flask import Flask
from flask_cors import CORS
import config
from models import init_db

app = Flask(__name__)
app.secret_key = config.SECRET_KEY
CORS(app, supports_credentials=True, origins=["http://localhost:5173"])

from auth import auth_bp
from spotify_routes import spotify_bp
from playlist_routes import playlist_bp

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(spotify_bp, url_prefix="/api/spotify")
app.register_blueprint(playlist_bp, url_prefix="/api/playlists")

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
