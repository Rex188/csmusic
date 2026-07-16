import os
import re
import sqlite3
import config

# PostgreSQL support — only imported when DATABASE_URL is set
DATABASE_URL = os.getenv("DATABASE_URL")


# ── SQLite backend (default / local dev) ───────────────────────────

def _sqlite_db():
    conn = sqlite3.connect(config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _init_sqlite():
    conn = _sqlite_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS netease_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
            cookie TEXT NOT NULL,
            netease_user_id TEXT,
            netease_nickname TEXT,
            netease_avatar TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            netease_playlist_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            image_url TEXT,
            track_count INTEGER,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, netease_playlist_id)
        );

        CREATE TABLE IF NOT EXISTS tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            netease_track_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            artist TEXT NOT NULL,
            album TEXT,
            image_url TEXT,
            duration INTEGER,
            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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


# ── PostgreSQL backend (Render production) ─────────────────────────

def _postgres_db():
    import psycopg2
    from psycopg2.extras import RealDictCursor

    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    conn.autocommit = False
    return _PostgresConnection(conn)


def _init_postgres():
    db = _postgres_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS netease_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
            cookie TEXT NOT NULL,
            netease_user_id TEXT,
            netease_nickname TEXT,
            netease_avatar TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS playlists (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            netease_playlist_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            image_url TEXT,
            track_count INTEGER,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, netease_playlist_id)
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS tracks (
            id SERIAL PRIMARY KEY,
            netease_track_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            artist TEXT NOT NULL,
            album TEXT,
            image_url TEXT,
            duration INTEGER,
            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS playlist_tracks (
            playlist_id INTEGER REFERENCES playlists(id),
            track_id INTEGER REFERENCES tracks(id),
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (playlist_id, track_id)
        )
    """)
    db.commit()
    db.close()


class _PostgresRow:
    """Adapter so psycopg2 RealDictRow behaves like sqlite3.Row."""
    def __init__(self, dict_row):
        self._row = dict_row

    def __getitem__(self, key):
        if isinstance(key, int):
            keys = list(self._row.keys())
            return self._row[keys[key]] if key < len(keys) else None
        return self._row.get(key)

    def __iter__(self):
        return iter(self._row.keys())

    def keys(self):
        return self._row.keys()


class _PostgresCursor:
    """Wraps psycopg2 cursor so .fetchone()/.fetchall() return _PostgresRow."""

    def __init__(self, cur):
        self._cur = cur
        self._lastrowid = None

    @property
    def lastrowid(self):
        return self._lastrowid

    def __iter__(self):
        for row in self._cur:
            yield _PostgresRow(row)

    def fetchone(self):
        row = self._cur.fetchone()
        return _PostgresRow(row) if row else None

    def fetchall(self):
        return [_PostgresRow(r) for r in self._cur.fetchall()]


class _PostgresConnection:
    """Wraps psycopg2 connection to match sqlite3 connection API."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=None):
        pg_sql = self._convert(sql)
        if params is None:
            params = []
        pg_params = [p if not isinstance(p, tuple) else p[0] for p in params]
        cur = self._conn.cursor()
        cur.execute(pg_sql, pg_params)
        wrapped = _PostgresCursor(cur)

        # For INSERT statements, capture the returned id for .lastrowid
        if pg_sql.strip().upper().startswith('INSERT') and 'RETURNING' not in pg_sql:
            try:
                cur.execute("SELECT LASTVAL()")
                wrapped._lastrowid = cur.fetchone()[0]
            except Exception:
                wrapped._lastrowid = None

        return wrapped

    def executescript(self, sql):
        """Split multiple statements and execute each."""
        statements = [s.strip() for s in sql.split(";") if s.strip()]
        for stmt in statements:
            self.execute(stmt)

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()

    @staticmethod
    def _convert(sql):
        """Convert SQLite-specific syntax to PostgreSQL."""
        has_ignore = 'INSERT OR IGNORE' in sql
        sql = sql.replace('INSERT OR IGNORE', 'INSERT')
        sql = sql.replace('?', '%s')
        if has_ignore:
            sql = sql.rstrip()
            if sql.endswith(';'):
                sql = sql[:-1]
            sql += ' ON CONFLICT DO NOTHING;'
        return sql


# ── Public API ────────────────────────────────────────────────────

def get_db():
    """Return a database connection (PostgreSQL in production, SQLite locally)."""
    if DATABASE_URL:
        return _postgres_db()
    return _sqlite_db()


def init_db():
    """Create all tables if they don't exist."""
    if DATABASE_URL:
        _init_postgres()
    else:
        _init_sqlite()
