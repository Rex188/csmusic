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
| Architect record | `D:/music thera/CLAUDE.md` | Discussions, timeline, file tree cheatsheet |

**IMPORTANT:** All paths relative to `D:/music thera/`. Python imports use the `backend/` package (e.g., `import config`, `import models` — run from inside `backend/`).

---

## Current Architecture

This section documents what actually exists. The original Spotify-oriented Task 1/2 specs are superseded — Spotify was dropped because it requires Premium for Web API access.

### 3-server stack

| Server | Dir | Port | Start command |
|---|---|---|---|
| Netease API | `D:/music thera/api-enhanced/` | 3000 | `node app.js` |
| Flask backend | `D:/music thera/project/backend/` | 5000 | `python app.py` |
| React/Vite | `D:/music thera/project/frontend/` | 5173 | `npm run dev` |

### Flask backend (`project/backend/`)

| File | Purpose |
|---|---|
| `app.py` | Flask entry point. Registers blueprints: `/api/auth`, `/api/netease`, `/api/playlists`. Standalone `/api/me` route. CORS → `localhost:5173`. |
| `config.py` | `SECRET_KEY`, `DATABASE_PATH` from env. `python-dotenv` loads `.env`. |
| `models.py` | `init_db()` creates 5 tables (users, netease_tokens, playlists, tracks, playlist_tracks). `get_db()` returns sqlite3 connection. |
| `auth.py` | `/api/auth/signup` (bcrypt, POST), `/api/auth/login` (POST), `/api/auth/logout` (POST). Session-based. |
| `netease_routes.py` | `/api/netease/qr/key` (GET), `/api/netease/qr/create?key=` (GET), `/api/netease/qr/check?key=` (GET), `/api/netease/connect` (POST, saves cookie), `/api/netease/status` (GET), `/api/netease/disconnect` (POST). Proxies to `localhost:3000`. |
| `playlist_routes.py` | `/api/playlists` (GET), `/api/playlists/import` (POST — fetches playlists + tracks from Netease via :3000, parallel ThreadPoolExecutor, saves to SQLite). |

### React frontend (`project/frontend/src/`)

| File | Purpose |
|---|---|
| `main.jsx` | ReactDOM entry. |
| `App.jsx` | BrowserRouter: `/login`, `/signup`, `/dashboard`, fallback → `/login`. |
| `api.js` | All API calls: auth (signup/login/logout/me), netease (qrKey/qrCreate/qrCheck/connect/status/disconnect), playlists (get/import). `credentials: 'include'` for session cookie. Content-type check before `.json()` to avoid "body stream already read". |
| `pages/Login.jsx` | Email + password form. |
| `pages/Signup.jsx` | Email + password + confirm. Client-side match check. |
| `pages/Dashboard.jsx` | Main page: Netease QR connect (5 visual states), countdown timer, playlist import with spinner + success summary, playlist grid with cover cards. `PlaylistCard` component inline. |
| `index.css` | Dark theme (#0a0a0a), Apple-minimal, `.card`, `.spinner`, `@keyframes pulse`. |

### API flow (end to end)

1. User signs up/logs in → Flask session cookie set
2. Frontend calls `/api/netease/qr/key` → `/api/netease/qr/create?key=...` → displays QR image
3. Frontend polls `/api/netease/qr/check?key=...` every 2s (recursive setTimeout)
4. User scans with Netease app → poll gets code 802 (scanning) → 803 (confirmed, cookie returned)
5. Frontend calls `/api/netease/connect` with cookie → saved to `netease_tokens` table
6. User clicks "Import Playlists" → `/api/playlists/import` POST → backend calls Netease API (`:3000`) for user playlists + tracks, saves to SQLite, returns playlist list
7. Dashboard renders playlist grid

### Database (SQLite, `backend/database.db`)

```sql
users (id PK, email UNIQUE, password_hash, created_at)
netease_tokens (id PK, user_id FK UNIQUE, cookie, netease_user_id, netease_nickname, netease_avatar, created_at, updated_at)
playlists (id PK, user_id FK, netease_playlist_id, name, description, image_url, track_count, imported_at, UNIQUE(user_id, netease_playlist_id))
tracks (id PK, netease_track_id UNIQUE, name, artist, album, image_url, duration, fetched_at)
playlist_tracks (playlist_id FK, track_id FK, added_at, PK(playlist_id, track_id))
```

No audio features table yet. Netease API doesn't expose energy/valence/tempo — needs custom librosa pipeline later.

---

## What's Done vs Not

### ✅ Done
- Flask backend: auth (bcrypt), Netease QR login, playlist import (parallel 5-thread, 120s timeout)
- React frontend: login, signup, dashboard (5-state QR UX, countdown, playlist grid)
- `backend/spotify_routes.py` deleted (replaced by netease_routes.py)
- `_unwrap()` helper handles double-wrapped api-enhanced responses
- Frontend "body stream already read" fix (content-type check before `.json()`)
- Deployed to Render: `https://music-self.onrender.com`
- PostgreSQL dual-backend (SQLite local / PG production via DATABASE_URL env var)
- Toast notification system: all alerts are animated popup toasts, replace inline errors
- QR state persisted per-user in sessionStorage (survives page refresh, no cross-user leak)
- Admin endpoint `/api/admin?key=xxx` + local CLI `python admin.py all`
- Render deployment config: `render.yaml` + Flask serves built React statically

### ❌ Not Yet Built
1. **Audio feature analysis** — librosa pipeline to get energy/valence/tempo from audio files
2. **Visual landscape / garden UI** — dashboard is still playlist cards, not the SOUL-inspired garden
3. **Social masks** — sharing a facet of your music-self
4. **Optional journaling / notes** — attaching thoughts to songs
5. **iOS app** — postponed

---
