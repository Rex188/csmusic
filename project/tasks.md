# Music-Self V1 — Implementation Tasks

**Assigned to:** DeepSeek (Senior Implementation Engineer)
**Architecture by:** Claude Opus 4.8 (Principal Software Architect)
**Date:** 2026-07-16

**Status:** Playlist selection + LLM analysis + admin panel + email verification all built and deployed to Render.

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
| `netease_routes.py` | `/api/netease/qr/key` (GET), `/api/netease/qr/create?key=` (GET), `/api/netease/qr/check?key=` (GET), `/api/netease/connect` (POST, saves cookie), `/api/netease/status` (GET), `/api/netease/disconnect` (POST). Proxies to `localhost:3000` (45s timeout for cold start). |
| `playlist_routes.py` | `/api/playlists` (GET), `/api/playlists/import` (POST — fetches playlists + tracks from Netease via :3000, parallel ThreadPoolExecutor, saves to SQLite). |
| `analysis_routes.py` | `/api/analysis/tracks/<id>` (GET — list tracks), `/api/analysis/analyze/<id>` (POST — sample + LLM analysis), `/api/analysis/status/<id>` (GET), `/api/analysis/_diag` (GET — LLM config debug). |
| `admin_routes.py` | `/api/admin` (GET — dashboard), `/api/admin/user/<id>` (DELETE), `/api/admin/playlist/<id>` (DELETE), `/api/admin/disconnect/<id>` (POST). ADMIN_KEY protected. |
| `email_service.py` | SMTP email sender for verification. Falls back to console log in dev. |

### React frontend (`project/frontend/src/`)

| File | Purpose |
|---|---|
| `main.jsx` | ReactDOM entry. |
| `App.jsx` | BrowserRouter: `/login`, `/signup`, `/dashboard`, fallback → `/login`. |
| `api.js` | All API calls: auth (signup/login/logout/me), netease (qrKey/qrCreate/qrCheck/connect/status/disconnect), playlists (get/import). `credentials: 'include'` for session cookie. Content-type check before `.json()` to avoid "body stream already read". |
| `pages/Login.jsx` | Email + password form. |
| `pages/Signup.jsx` | Email + password + confirm. Client-side match check. |
| `pages/Dashboard.jsx` | Main page: Netease QR connect (5 visual states), countdown timer, playlist import with spinner + success summary, playlist grid with clickable cards + detail panel (track list + Analyze button + LLM results), `PlaylistCard` component inline. |
| `pages/Admin.jsx` | `/admin` page: key login, stats cards, User/Playlist/Netease tables with Delete/Disconnect + confirm dialog. |
| `pages/Verify.jsx` | `/verify?token=xxx` page: verifying/success/error states with auto-login. |
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
- **Playlist selection** — clickable cards with purple highlight, track list panel with covers/artists
- **LLM playlist analysis** — samples up to 40 tracks, sends to LLM (OpenAI-compatible), returns structured analysis (vibe, mood, energy, valence, tempo, genres, insight)
- **Configurable LLM provider** — DeepSeek (default), OpenAI, Ollama via env vars
- **Admin panel UI** — `/admin` page with key login, stats cards, User/Playlist/Netease management tables with Delete/Disconnect (confirm dialog)
- **Email verification** — `email_verified` column + `email_verifications` table, signup sends verification email (SMTP / console fallback), `/auth/verify/<token>` endpoint, dashboard banner, admin shows verified status
- **Schema migration system** — `_run_migrations_sqlite()` / `_run_migrations_postgres()` for adding columns to existing databases

### ❌ Not Yet Built
1. **Visual landscape / garden UI** — dashboard is still playlist cards, not the SOUL-inspired garden
2. **Librosa audio analysis pipeline** — custom ML for tempo, key, energy from audio files
3. **Social masks** — sharing a facet of your music-self
4. **Optional journaling / notes** — attaching thoughts to songs
5. **iOS app** — postponed

### 🐛 Known Issues
1. **QR state persistence across users (partial fix in place).** sessionStorage now binds QR state to user ID, but on a shared machine, switching users can still show stale UI if the previous user's QR was in 'waiting' state before logout. Full fix needs proper per-user state cleanup on logout — deferred.
2. **Delete user then re-register works now** (fixed cascade deleting email_verifications).
3. ~~Email verification not available.~~ — **FIXED.** SMTP configured in `.env`. `verification_url` is now always returned (signup + resend), frontend shows clickable fallback link when SMTP fails. (2026-07-18)

---

---

## Bugfix — Email Verification Recovery Path

**Date:** 2026-07-18
**Root cause:** Two design defects in the verification flow prevent users from verifying their email when SMTP is down or misconfigured.

### The Three Issues

| # | Where | Problem |
|---|---|---|
| 1 | `backend/.env` | No SMTP env vars — emails can't be sent |
| 2 | `auth.py:55-60` (signup) | `verification_url` is gated behind `if not config.SMTP_HOST:` — if SMTP is configured but broken, the URL disappears and user has no recovery |
| 3 | `auth.py:152-189` (resend) | Response never includes `verification_url` — once user leaves the signup page, "Resend" shows "Failed" with no fallback link |

### Architectural Reasoning

`verification_url` is NOT a dev-mode fallback. It's the **only recovery path** when SMTP fails for any reason (wrong creds, provider down, spam filter eats the email). The frontend already has the right structure — it reads both `verification_sent` (boolean) and `verification_url` (string|null) independently. The backend just needs to stop coupling them — always compute the URL, let `verification_sent` carry the "did email send" signal separately.

### Fix 1 — `backend/auth.py` signup endpoint (line 55-60)

**Current code:**
```python
        sent, _ = send_verification_email(email, token)
        verification_sent = sent
        # In dev mode, include the URL so the frontend can show it
        if not config.SMTP_HOST:
            app_url = config.APP_URL
            verification_url = f"{app_url.rstrip('/')}/verify?token={token}"
```

**Replace with:**
```python
        sent, smtp_error = send_verification_email(email, token)
        verification_sent = sent
        # Always include the verification URL so the user can copy-paste it
        # even if SMTP is misconfigured or the email never arrives
        app_url = config.APP_URL
        verification_url = f"{app_url.rstrip('/')}/verify?token={token}"
```

**What changes:** Remove the `if not config.SMTP_HOST:` guard. `verification_url` is now always set.

### Fix 2 — `backend/auth.py` resend endpoint (line 185-189)

**Current code:**
```python
    sent, _ = send_verification_email(user["email"], token)
    return jsonify({
        "verification_sent": sent,
        "message": "Verification email sent." if sent else "Failed to send email."
    })
```

**Replace with:**
```python
    sent, smtp_error = send_verification_email(user["email"], token)
    app_url = config.APP_URL
    verification_url = f"{app_url.rstrip('/')}/verify?token={token}"
    return jsonify({
        "verification_sent": sent,
        "verification_url": verification_url,
        "message": "Verification email sent." if sent else "Failed to send email."
    })
```

**What changes:** Add `verification_url` to the response JSON. Same pattern as signup — always computed, always returned. Optional: if SMTP failed and we have the error, include it in the response so the frontend can show more detail.

### Fix 3 — `frontend/src/pages/Signup.jsx` (line 65-80)

The "Cannot send" warning currently shows only when `!verificationSent`. But `verificationUrl` may be present even when `verificationSent` is true — for example, if SMTP says "sent" but the email goes to spam. The UI should show the fallback link whenever `verificationUrl` is present.

**Current logic (simplified):**
```jsx
{verificationSent && (<p>✉️ Verification email sent — check your inbox.</p>)}
{!verificationSent && (
  <div>  {/* warning with verificationUrl fallback link */}  </div>
)}
```

**Replace with:**
```jsx
{verificationSent && (
  <p style={{ color: '#4ade80', fontSize: 13, margin: '12px 0' }}>
    ✉️ Verification email sent — check your inbox.
  </p>
)}

{!verificationSent && verificationUrl && (
  <div style={{ margin: '12px 0', padding: 12, borderRadius: 8, background: '#1a1a1a', fontSize: 13 }}>
    <p style={{ color: '#fbbf24', marginBottom: 4 }}>⚠️ Email could not be sent</p>
    <p style={{ color: '#888' }}>SMTP may not be configured. Use the link below to verify:</p>
    <div style={{ marginTop: 8 }}>
      <a href={verificationUrl} style={{ color: '#a78bfa', fontSize: 12, wordBreak: 'break-all' }}>
        {verificationUrl}
      </a>
    </div>
  </div>
)}

{!verificationSent && !verificationUrl && (
  <div style={{ margin: '12px 0', padding: 12, borderRadius: 8, background: '#1a1a1a', fontSize: 13 }}>
    <p style={{ color: '#fbbf24', marginBottom: 4 }}>⚠️ Cannot send verification email</p>
    <p style={{ color: '#888' }}>SMTP not configured on the server. You can still use the app.</p>
  </div>
)}
```

### Fix 4 — `backend/.env`

Add SMTP placeholder variables so the configuration gap is visible:

```
# SMTP for email verification (Brevo / SendGrid / etc.)
# SMTP_HOST=smtp-relay.brevo.com
# SMTP_PORT=587
# SMTP_USER=your-login@brevo.com
# SMTP_PASS=your-smtp-key
```

### ⚠️ Security — Keep Secrets Out of Git

The real `.env` file (with actual API keys, SMTP credentials, `SECRET_KEY`, `ADMIN_KEY`) **must never be committed or pushed**. `.gitignore` already covers `.env`, but verify it before committing:

```bash
# Check what would be committed (run before every commit)
git status

# Verify .env is actually ignored
git check-ignore backend/.env
```

**Before any `git commit`:**
1. Run `git status` and confirm `backend/.env` is NOT in the staged list
2. If it shows up, run: `git rm --cached backend/.env` (removes from tracking, keeps file on disk)
3. Never use `git add .` or `git add -A` — stage files explicitly

**What's already gitignored (verify these stay ignored):**
- `*.env` (all env files)
- `database.db` (local SQLite with real user data)
- `venv/`, `node_modules/`, `dist/`, `__pycache__/`

### Files Changed (summary)

| File | Change |
|---|---|
| `backend/auth.py` | Remove `if not config.SMTP_HOST:` guard on `verification_url` (signup); add `verification_url` to resend response |
| `frontend/src/pages/Signup.jsx` | Show `verificationUrl` fallback link whenever present, independent of `verificationSent` |
| `backend/.env` | Add commented SMTP placeholders |

### Acceptance Criteria

- [ ] Signup always returns `verification_url` in the response (regardless of SMTP config)
- [ ] Resend always returns `verification_url` in the response
- [ ] Signup page shows clickable verification link when SMTP fails (not just when SMTP is unset)
- [ ] Resend failure still gives the user a clickable link to verify
- [ ] No behavior change when SMTP is working (existing flow untouched)
- [ ] Production Render env vars unchanged (just `.env` placeholders added)


## 🚀 Try It Live
