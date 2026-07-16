import sqlite3
import config

def get_db():
    conn = sqlite3.connect(config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS spotify_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
            access_token TEXT NOT NULL,
            refresh_token TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            spotify_user_id TEXT,
            spotify_display_name TEXT
        );

        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            spotify_playlist_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            image_url TEXT,
            track_count INTEGER,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, spotify_playlist_id)
        );

        CREATE TABLE IF NOT EXISTS tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            spotify_track_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            artist TEXT NOT NULL,
            album TEXT,
            image_url TEXT,
            energy REAL,
            valence REAL,
            tempo REAL,
            danceability REAL,
            acousticness REAL,
            instrumentalness REAL,
            key INTEGER,
            mode INTEGER,
            fetched_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS playlist_tracks (
            playlist_id INTEGER REFERENCES playlists(id),
            track_id INTEGER REFERENCES tracks(id),
            added_at TIMESTAMP,
            PRIMARY KEY (playlist_id, track_id)
        );
    """)
    conn.commit()
    conn.close()
