# Music-Self V1 — Implementation Tasks

**Assigned to:** DeepSeek (Senior Implementation Engineer)
**Architecture by:** Claude Opus 4.8 (Principal Software Architect)
**Date:** 2026-07-16

**Status:** V1 fully functional, deployed to Render. QR login (5-state UX, countdown, polling) + playlist import (parallel, error-resilient) + admin endpoint + dashboard rendering all verified working.

You are building the V1 skeleton of Music-Self. **Do not redesign anything.** Implement exactly what's specified. If something is ambiguous or broken, flag it — don't improvise.

---

## 📁 File Locations

**Project root:** `D:/music thera/`

**Our code:** `D:/music thera/project/`

| Layer | Location | Key file |
|---|---|---|
| Netease API server | `D:/music thera/api-enhanced/` | `app.js` (run from that dir: `node app.js`) |
| Flask backend | `D:/music thera/project/backend/` | `app.py` (entry point, all blueprint registration) |
| React frontend | `D:/music thera/project/frontend/` | `src/main.jsx` (entry), `src/App.jsx` (routes) |
| Python venv | `D:/music thera/project/venv/` | Activate: `source venv/Scripts/activate` |
| Frontend pages | `D:/music thera/project/frontend/src/pages/` | Dashboard.jsx, Login.jsx, Signup.jsx |
| Frontend API calls | `D:/music thera/project/frontend/src/api.js` | All backend endpoints defined here |
| Backend routes | `D:/music thera/project/backend/` | auth.py, netease_routes.py, playlist_routes.py |
| Database schema | `D:/music thera/project/backend/models.py` | `init_db()` creates all 5 tables |
| Config | `D:/music thera/project/backend/config.py` | Loads env vars; `.env` file lives next to it |
| Design docs | `D:/music thera/project/design-questions.md` | Full design decisions |
| This file | `D:/music thera/project/tasks.md` | Task specs + bugfix specs + history |
| Architect record | `D:/music thera/CLAUDE.md` | Discussions, timeline, cheatsheet |

**IMPORTANT:** All paths are relative to `D:/music thera/`. Python imports use the `backend/` package (e.g., `import config`, `import models` — run from inside `backend/`).

---

## What We're Building

A web app where users sign up, connect their Netease Cloud Music account via QR code, import playlists, and see them on a clean dark-mode dashboard. Flask REST API backend + React frontend + SQLite. Music data comes from a separate Netease Cloud Music API Enhanced server running on port 3000.

## Task Order

Do Task 1 first, then Task 2. Each file can be created independently within a task, but tasks are sequential (frontend needs the API to exist first).

---

## Task 1 — Flask Backend

### 1a. `backend/requirements.txt`

```
flask
flask-cors
bcrypt
spotipy
python-dotenv
```

After creating this file, install with: `source venv/Scripts/activate && pip install -r backend/requirements.txt`

### 1b. `backend/config.py`

Loads config from environment variables. `python-dotenv` auto-loads `.env`.

```python
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "http://localhost:5000/api/spotify/callback")
DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")
```

### 1c. `backend/models.py`

SQLite setup. `init_db()` creates all tables if they don't exist. Returns nothing.

Tables:

```sql
users (id INTEGER PK AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
spotify_tokens (id INTEGER PK AUTOINCREMENT, user_id INTEGER UNIQUE NOT NULL REFERENCES users(id), access_token TEXT NOT NULL, refresh_token TEXT NOT NULL, expires_at TIMESTAMP NOT NULL, spotify_user_id TEXT, spotify_display_name TEXT)
playlists (id INTEGER PK AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), spotify_playlist_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, image_url TEXT, track_count INTEGER, imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, spotify_playlist_id))
tracks (id INTEGER PK AUTOINCREMENT, spotify_track_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL, artist TEXT NOT NULL, album TEXT, image_url TEXT, energy REAL, valence REAL, tempo REAL, danceability REAL, acousticness REAL, instrumentalness REAL, key INTEGER, mode INTEGER, fetched_at TIMESTAMP)
playlist_tracks (playlist_id INTEGER REFERENCES playlists(id), track_id INTEGER REFERENCES tracks(id), added_at TIMESTAMP, PRIMARY KEY (playlist_id, track_id))
```

Also provide a helper: `get_db()` that returns a sqlite3 connection with `row_factory = sqlite3.Row`.

### 1d. `backend/auth.py`

Flask Blueprint at `/api/auth`. Each route returns JSON.

**POST `/api/auth/signup`**
- Body: `{"email": "...", "password": "..."}`
- Hash password with bcrypt, insert user, log them in (set `session["user_id"]`)
- Return: `{"user": {"id": 1, "email": "..."}}` with status 201
- Errors: 409 if email exists, 400 if missing fields

**POST `/api/auth/login`**
- Body: `{"email": "...", "password": "..."}`
- Verify bcrypt hash, set `session["user_id"]`
- Return: `{"user": {"id": 1, "email": "..."}}`
- Errors: 401 if wrong credentials, 400 if missing fields

**POST `/api/auth/logout`**
- Clear session
- Return: `{"ok": true}`

**GET `/api/me`**
- If `session["user_id"]` exists, return `{"user": {"id": 1, "email": "..."}}`
- Otherwise: `{"user": null}` with status 401

**Session setup:** Use Flask's built-in session (cookie-based). In `app.py` you'll set `app.secret_key = config.SECRET_KEY`.

### 1e. `backend/spotify_routes.py`

Flask Blueprint at `/api/spotify`. Protected — every route requires `session["user_id"]`.

**GET `/api/spotify/connect`**
- Build a spotipy `SpotifyOAuth` object using config values and a cache_handler that does nothing (we handle tokens manually)
- `scope = "playlist-read-private playlist-read-collaborative"`
- Return: `{"url": oauth.get_authorize_url()}` — frontend redirects user to this URL
- Note: do NOT use `cache_path` on SpotifyOAuth. Instead subclass `CacheHandler` and make `get_cached_token` return None, `save_token_to_cache` be a no-op. Or just construct the auth URL manually:

```python
import urllib.parse
params = {
    "client_id": config.SPOTIFY_CLIENT_ID,
    "response_type": "code",
    "redirect_uri": config.SPOTIFY_REDIRECT_URI,
    "scope": "playlist-read-private playlist-read-collaborative",
    "state": str(user_id)  # to verify on callback
}
url = "https://accounts.spotify.com/authorize?" + urllib.parse.urlencode(params)
return {"url": url}
```

**GET `/api/spotify/callback`**
- Query params: `code`, `state` (contains user_id)
- Exchange code for tokens using `spotipy.oauth2.SpotifyOAuth` (or manually POST to `https://accounts.spotify.com/api/token`)
- Get the Spotify user profile with the access token (GET `https://api.spotify.com/v1/me`)
- Upsert into `spotify_tokens` table (INSERT OR REPLACE)
- Redirect to frontend dashboard: `redirect("http://localhost:5173/dashboard")`
- Handle errors gracefully

Token exchange via requests:
```python
import requests
resp = requests.post("https://accounts.spotify.com/api/token", data={
    "grant_type": "authorization_code",
    "code": code,
    "redirect_uri": config.SPOTIFY_REDIRECT_URI,
    "client_id": config.SPOTIFY_CLIENT_ID,
    "client_secret": config.SPOTIFY_CLIENT_SECRET,
})
tokens = resp.json()
# tokens["access_token"], tokens["refresh_token"], tokens["expires_in"]
```

**GET `/api/spotify/status`**
- Look up spotify_tokens row for current user
- Return: `{"connected": true, "display_name": "Name", "spotify_user_id": "..."}`
- If not connected: `{"connected": false}`

### 1f. `backend/playlist_routes.py`

Flask Blueprint at `/api/playlists`. Protected.

**GET `/api/playlists`**
- SELECT playlists WHERE user_id = session user
- Return: `{"playlists": [...]}` — array of playlist objects (id, name, description, image_url, track_count, imported_at)

**POST `/api/playlists/import`**
- Get user's Spotify access token from DB
- If token expired, refresh it using the refresh token (POST to Spotify token endpoint with `grant_type: "refresh_token"`). Update DB with new tokens.
- Use the access token to call Spotify API: GET `https://api.spotify.com/v1/me/playlists?limit=50`
- For each playlist, get its tracks: GET `https://api.spotify.com/v1/playlists/{id}/tracks?limit=100`
- Save playlist to `playlists` table (use INSERT OR IGNORE to handle duplicates)
- For tracks: INSERT OR IGNORE into `tracks` table (use spotify_track_id as unique key)
- Link them in `playlist_tracks` junction table
- After inserting tracks, fetch audio features in batches of 100: GET `https://api.spotify.com/v1/audio-features?ids=id1,id2,...`
- UPDATE tracks SET energy=..., valence=..., etc. WHERE spotify_track_id = ?
- Return: `{"imported": <count>, "playlists": [...]}`

**Important:** The Spotify API calls use `Authorization: Bearer {access_token}` header. Use the `requests` library — don't rely on spotipy for the data-fetching parts since we're managing tokens manually. Actually, you CAN use spotipy for the data fetching: create a `Spotify(auth=access_token)` instance and use its methods like `.current_user_playlists()`, `.playlist_tracks()`, `.audio_features(track_ids)`. Simpler than raw requests.

**Refresh logic helper:**
```python
def get_valid_token(user_id):
    # get tokens from DB
    # if access_token expired (check expires_at vs now):
    #     POST to https://accounts.spotify.com/api/token
    #     with grant_type=refresh_token, refresh_token=...
    #     UPDATE spotify_tokens SET ...
    # return valid access_token
```

### 1g. `backend/app.py`

```python
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
```

### 1h. `backend/.env` (template)

Create a `.env.example`:
```
SECRET_KEY=change-me-to-random
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:5000/api/spotify/callback
```

---

## Task 2 — React Frontend

### 2a. Setup

From `D:/music thera/project/` run:
```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install react-router-dom
```

### 2b. `frontend/vite.config.js`

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
```

### 2c. `frontend/src/api.js`

```javascript
const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/me'),
  spotifyStatus: () => request('/spotify/status'),
  spotifyConnect: () => request('/spotify/connect'),
  getPlaylists: () => request('/playlists'),
  importPlaylists: () => request('/playlists/import', { method: 'POST' }),
};
```

### 2d. `frontend/src/pages/Login.jsx`

- Email + password form
- On submit: call `api.login()`, navigate to `/dashboard` on success
- Show error message on failure
- Link to `/signup`
- Clean, minimal. Single column centered.

### 2e. `frontend/src/pages/Signup.jsx`

- Email + password + confirm password form
- Client-side: check passwords match
- On submit: call `api.signup()`, navigate to `/dashboard` on success
- Show error message on failure
- Link to `/login`

### 2f. `frontend/src/pages/Dashboard.jsx`

This is the main page. Load state on mount:

1. Call `api.me()` — if null, redirect to `/login`
2. Call `api.spotifyStatus()` — shows connect button or "Connected as X"
3. Call `api.getPlaylists()` — shows playlist grid

Layout:
```
┌──────────────────────────────────────────────┐
│  music-self                          [logout] │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  Welcome back                             │ │
│  │                                          │ │
│  │  [Connect Spotify]  or  Connected as Name │ │
│  │  [Import Playlists]                       │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │ img  │ │ img  │ │ img  │ │ img  │         │
│  │ Name │ │ Name │ │ Name │ │ Name │         │
│  │ 42tr │ │ 18tr │ │ 67tr │ │ 31tr │         │
│  │ ●●●  │ │ ●○○  │ │ ●●○  │ │ ●●●  │         │
│  └──────┘ └──────┘ └──────┘ └──────┘         │
└──────────────────────────────────────────────┘
```

Each playlist card shows:
- Cover image (or placeholder gray square if none)
- Playlist name
- Track count
- Energy indicator: colored bar (0.0 = gray, 1.0 = bright green/yellow)
- Valence indicator: colored bar (0.0 = blue/cool, 1.0 = warm/orange)
- Small gradient circle: CSS `radial-gradient` where saturation comes from average energy of the playlist, hue comes from average valence

Import Playlists button:
- Calls `api.importPlaylists()`
- Shows loading state while fetching
- Refreshes the playlist grid on success
- Show count of imported playlists

Logout button:
- Top right
- Calls `api.logout()`, navigates to `/login`

### 2g. `frontend/src/App.jsx`

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### 2h. `frontend/src/styles/global.css`

Dark, Apple-minimal. Apply to `body` and inherited.

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: #0a0a0a;
  color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

/* Forms */
input {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 12px 16px;
  color: #f5f5f5;
  font-size: 16px;
  width: 100%;
  outline: none;
  transition: border-color 0.2s;
}
input:focus { border-color: #4a4a4a; }

button {
  background: #fff;
  color: #0a0a0a;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}
button:hover { opacity: 0.8; }
button:disabled { opacity: 0.4; cursor: default; }

a {
  color: #888;
  text-decoration: none;
}
a:hover { color: #fff; }

/* Utility */
.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 24px;
}

.card {
  background: #111;
  border: 1px solid #1a1a1a;
  border-radius: 12px;
  padding: 20px;
  transition: border-color 0.2s;
}
.card:hover { border-color: #2a2a2a; }
```

---

## Acceptance Criteria

1. **Netease API server** (api-enhanced) runs on port 3000
2. **Flask starts** on port 5000, all routes registered
3. **Vite starts** on port 5173, proxy `/api` to Flask
4. **Sign up** → creates user in SQLite, redirects to dashboard
5. **Login** → authenticates, sets session
6. **QR login flow** → get key → show QR → poll → scan → cookie saved → "Connected as ..."
7. **Import Playlists** → playlists + tracks from Netease saved to DB, rendered as cards
8. **Dashboard** shows playlist grid with cover images and track counts
9. **Persistence** — restart Flask, data still there in SQLite
10. **Errors don't crash** — wrong password, missing fields, Netease not connected — all show user-friendly messages
11. **Dark, clean, Apple-minimal** look throughout

---

## 🐛 Bugfix — QR Login UX (2026-07-16)

Two bugs reported by the user after scanning the QR code:

### Bug 1: No visual feedback after scanning

**Root cause analysis:**

There are three problems in the QR flow:

**Problem A — No loading state while generating QR.** `handleShowQr()` does two async calls (`qr/key` then `qr/create`) before `qrImg` is set. During this gap the button is gone (`connecting=true`) but no QR image shows yet (`qrImg=null`). The user sees nothing happening — no spinner, no "Generating..." text.

**Fix:** After `setConnecting(true)`, show a "Generating QR code..." message before `qrImg` is available.

**Problem B — Response unwrapping might be wrong.** The `api-enhanced` server wraps all responses as `{code: 200, data: {...}}` or `{code: 200, body: {...}}`. Our backend inconsistently uses `data.get("body", data)` which breaks if the server uses `data` instead of `body`.

Specifically in `qr/check`:
```python
data = _proxy("/login/qr/check", {"key": key})
body = data.get("body", data)
if body.get("code") == 803:  # ← code might be 200 (outer wrapper), never matches
```

If `data = {code: 200, data: {code: 802}}` and we do `data.get("body", data)`, we get `{code: 200, data: {code: 802}}` whose `.code` is 200, not 802. The polling returns 801 forever. User scans, status never changes.

**Fix:** In all `_proxy` calls in `netease_routes.py`, unwrap both `body` and `data`:
```python
def _proxy(path, params=None, method="GET"):
    ...
    result = resp.json()
    return result.get("body") or result.get("data") or result
```

Then use that unwrapped result directly in route handlers.

**Problem C — No distinct visual states.** Currently only two text states: "Scan with app" or "Scanned!". Missing: "Generating QR...", "Connecting..." (after 803 before connect API returns), and a visible pulsing animation on the QR while waiting.

**Fix:** Add more granular status states with CSS animation.

### Bug 2: QR code expires too quickly

**Root cause:** Netease QR codes expire in ~2-5 minutes server-side. No countdown shown, expired message is tiny red text, retry is a small underlined link.

**Fix:** Add a countdown timer and prominent retry button.

---

### What to fix

#### Backend: `backend/netease_routes.py`

1. **Fix `_proxy()` response unwrapping** — unwrap both `body` and `data`:
```python
def _proxy(path, params=None, method="GET"):
    url = f"{NCM_API}{path}"
    try:
        if method == "GET":
            resp = requests.get(url, params=params, timeout=15)
        else:
            resp = requests.post(url, data=params, timeout=15)
        result = resp.json()
        # api-enhanced wraps in either "body" or "data" — unwrap both
        return result.get("body") or result.get("data") or result
    except requests.exceptions.ConnectionError:
        return {"code": -1, "error": "Netease API server not running on port 3000"}
    except Exception as e:
        return {"code": -1, "error": str(e)}
```

2. **Simplify QR route handlers** — since `_proxy` now returns the unwrapped inner object, remove the redundant `.get("body", ...)` calls:

`qr/key`: `data = _proxy("/login/qr/key")` → `return jsonify(data)` (data is already unwrapped, frontend expects `{data: {unikey: ...}}` — actually, check: the api-enhanced body for qr/key looks like `{code: 200, data: {unikey: "..."}}`. After unwrapping we get `{code: 200, data: {unikey: "..."}}`. Frontend does `keyResp?.data?.unikey`. This still works because the unwrapped inner object IS `{code: 200, data: {unikey: "..."}}`.

Wait — let me be more precise. The api-enhanced server response structure:
- Outer: `{code: 200, data: {code: 200, data: {unikey: "..."}}}` — sometimes double-wrapped
- OR: `{code: 200, body: {code: 200, data: {unikey: "..."}}}` — sometimes uses `body`

The inner object (whether keyed by `data` or `body`) has `{code: 200, data: {unikey: "..."}}`

After `_proxy` returns `result.get("body") or result.get("data") or result`, we get `{code: 200, data: {unikey: "..."}}`.

Then frontend does `keyResp?.data?.unikey` → gets the unikey. ✓

For `qr/create`: same pattern. ✓

For `qr/check`: after unwrap we get `{code: 801, ...}` or `{code: 802, ...}` or `{code: 803, cookie: "..."}`. Frontend accesses `check.code` directly. ✓

So the fix is: make `_proxy` unwrap, then in route handlers use the unwrapped data directly without `.get("body", ...)`.

3. **Update each route handler** to match:

```python
@netease_bp.route("/qr/key", methods=["GET"])
def qr_key():
    data = _proxy("/login/qr/key")
    return jsonify(data)  # already unwrapped by _proxy

@netease_bp.route("/qr/create", methods=["GET"])
def qr_create():
    key = request.args.get("key")
    if not key:
        return jsonify({"error": "key required"}), 400
    data = _proxy("/login/qr/create", {"key": key, "qrimg": "1"})
    return jsonify(data)

@netease_bp.route("/qr/check", methods=["GET"])
def qr_check():
    key = request.args.get("key")
    if not key:
        return jsonify({"error": "key required"}), 400
    body = _proxy("/login/qr/check", {"key": key})
    # body is now the inner response: {code: 801/802/803, cookie?: "..."}
    code = body.get("code")
    if code == 803:
        return jsonify({"code": 803, "cookie": body.get("cookie", "")})
    if code == 800:
        return jsonify({"code": 800, "message": "QR code expired"})
    if code == 802:
        return jsonify({"code": 802, "message": "Scanning, confirm on phone"})
    return jsonify({"code": 801, "message": "Waiting for scan"})
```

#### Frontend: `frontend/src/pages/Dashboard.jsx`

New QR state machine with 5 visible states:

| State | What user sees |
|---|---|
| `generating` | "Generating QR code..." spinner — while key/create APIs load |
| `waiting` | QR image + pulsing ring + "📱 Scan with Netease Cloud Music app" + countdown |
| `scanning` | QR image dimmed + green checkmark + "✅ Scanned! Confirm on your phone..." |
| `connecting` | "Connecting to Netease..." spinner — after 803 before connect API returns |
| `expired` | "QR code expired" + prominent retry button (not tiny link) |

Add a `pollFailCount` ref — if 15 consecutive polls fail (30 seconds), stop polling and show "Connection lost — please retry".

Add a countdown: start at 180 seconds (3 min), decrement every second via a separate `setInterval`. Show "Expires in 2:45" below the QR. When it hits 0, treat as expired.

The QR image section should always show some status, even during initial loading:

```jsx
{connecting && (
  <div style={{ textAlign: 'center' }}>
    {qrStatus === 'generating' && (
      <div>
        <div className="spinner" />
        <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Generating QR code...</p>
      </div>
    )}
    {qrImg && (qrStatus === 'waiting' || qrStatus === 'scanning') && (
      <div>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img src={qrImg} alt="QR code"
            style={{
              width: 180, height: 180, borderRadius: 8, background: '#fff', padding: 8,
              opacity: qrStatus === 'scanning' ? 0.5 : 1,
              transition: 'opacity 0.3s'
            }} />
          {qrStatus === 'waiting' && (
            <div style={{
              position: 'absolute', inset: -4, borderRadius: 12,
              border: '2px solid #a78bfa', animation: 'pulse 2s infinite'
            }} />
          )}
          {qrStatus === 'scanning' && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              fontSize: 48
            }}>✅</div>
          )}
        </div>
        <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>
          {qrStatus === 'scanning'
            ? '✅ Scanned! Confirm on your phone...'
            : '📱 Scan with Netease Cloud Music app'}
        </p>
        {qrStatus === 'waiting' && countdown > 0 && (
          <p style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
            Expires in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
          </p>
        )}
      </div>
    )}
    {!qrImg && qrStatus === 'connecting' && (
      <div>
        <div className="spinner" />
        <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Connecting to Netease...</p>
      </div>
    )}
    {qrStatus === 'expired' && (
      <div>
        <p style={{ fontSize: 14, color: '#f87171', marginBottom: 12 }}>QR code expired</p>
        <button onClick={handleRetryQr} style={{ background: '#1a1a1a', color: '#a78bfa' }}>
          Generate new QR code
        </button>
      </div>
    )}
  </div>
)}
```

#### Frontend: `frontend/src/index.css`

Add the pulse animation:
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #2a2a2a;
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

### How to verify

1. Start all three servers (Netease API :3000, Flask :5000, Vite :5173)
2. Login → Dashboard → Click "Connect Netease Cloud Music"
3. **Verify:** "Generating QR code..." spinner appears briefly
4. **Verify:** QR code appears with pulsing border and countdown timer
5. Scan with Netease app
6. **Verify:** QR dims, green checkmark appears, text changes to "Scanned! Confirm on your phone..."
7. Confirm on phone
8. **Verify:** "Connecting to Netease..." spinner appears briefly
9. **Verify:** Dashboard shows "Connected as [nickname]"
10. **Verify:** If wait > 3 min without scanning, QR shows "expired" with prominent retry button
11. **Verify:** If Netease API server is stopped mid-poll, after ~30 seconds shows error instead of silently hanging

---

## Before You Start

- Python venv is at `D:/music thera/project/venv/` (Python 3.11)
- Activate it before pip installs or running Flask
- Netease API server must be running on `localhost:3000` (clone `api-enhanced`, run `node app.js`)
- npm/node must be available. Check with `node --version`. If not installed, install it.







# UPDATES

## ✅ Done (Implemented)

### Backend (Flask)
- `backend/app.py` — Flask app with CORS, 3 blueprints
- `backend/config.py` — Env var loading
- `backend/models.py` — SQLite schema (5 tables: users, netease_tokens, playlists, tracks, playlist_tracks)
- `backend/auth.py` — signup (bcrypt), login, logout, session /me
- `backend/netease_routes.py` — QR login flow (key → create → poll → save cookie), connect/disconnect, status
- `backend/playlist_routes.py` — list playlists, import (fetches user playlists + tracks via Netease API proxy)
- `backend/requirements.txt`, `backend/.env.example`

### Frontend (React/Vite)
- `frontend/vite.config.js` — proxy `/api` → Flask :5000
- `frontend/src/api.js` — API client with all Netease + playlist methods
- `frontend/src/pages/Login.jsx` — email/password form
- `frontend/src/pages/Signup.jsx` — email/password/confirm
- `frontend/src/pages/Dashboard.jsx` — Netease QR connect, import, playlist grid
- `frontend/src/App.jsx` — Router (3 routes)
- `frontend/src/index.css` — Dark Apple-minimal theme

### Verified
- Flask starts on :5000 ✅
- Vite builds in ~135ms ✅

---

## ❌ Not Finished (Needs Doing)

### Missing Infrastructure
1. **Netease API server not set up** — Need to clone and run `api-enhanced` locally on port 3000 (Node.js required)
2. **No `.env` file created** — `backend/.env.example` exists but `.env` hasn't been copied and configured
3. **No actual test run** — Haven't tested the full auth → QR login → import flow end-to-end

### Not Yet Built (Post-V1)
4. **Audio feature analysis** — Netease doesn't provide energy/valence/tempo. We'll need librosa to analyze songs locally (download from Netease URL or user uploads)
5. **"Music-self" visual landscape** — The dashboard is still a raw playlist grid, not a garden/abstract visual
6. **Social masks** — Not started
7. **Optional journaling / notes** — Not started
8. **iOS app** — Postponed

---

## Timeline

| Time                         | Event                                                        |
| ---------------------------- | ------------------------------------------------------------ |
| Before this session          | Spotify API chosen, then blocked (Premium required)          |
| This session start           | Pivoted to Netease Cloud Music API-enhanced                  |
| `backend/netease_routes.py`  | QR login flow built (key → create → poll → connect)          |
| `backend/playlist_routes.py` | Rewrote to proxy Netease API instead of Spotify              |
| `frontend/api.js`            | Updated with Netease endpoints                               |
| `backend/spotify_routes.py`  | Deleted                                                      |
| **NOW**                     | V1 complete. QR login (5-state UX, countdown, _unwrap fix) + playlist import (parallel 5-thread, NoneType fix, 120s timeout) + dashboard rendering all verified working. |
|                             | Next: Visual landscape / garden UI, librosa audio analysis, social masks.
