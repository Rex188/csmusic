# Music-Self V1 — Implementation Tasks

**Assigned to:** DeepSeek (Senior Implementation Engineer)
**Architecture by:** Claude Opus 4.8 (Principal Software Architect)
**Debugging by:** Debugger (Senior Debugging Engineer)
**Date:** 2026-07-16

**Status:** ✅ **All phases done.** Frontend UI Redesign (Apple-Style) implemented and then pivoted to monochrome (black/white/gray, Helvetica) per user feedback. Playlist selection + LLM analysis + admin panel + email verification all built and deployed to Render.

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
| Role files | `D:/music thera/project/` | `claude role.md` (architect), `ds role.md` (implementer), `role debugger.md` (debugger) |
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
- **Email verification recovery path** — `verification_url` always returned (signup + resend), decoupled from SMTP status. Frontend shows clickable fallback link whenever present. (`backend/auth.py`, `frontend/src/pages/Signup.jsx`)
- **Loading states for cold-start** — Signup and Login buttons now show spinner + text during submission, preventing confusion during Render's 15-20s cold start + SMTP timeout. (`frontend/src/pages/Signup.jsx`, `frontend/src/pages/Login.jsx`)
- **Explicit dotenv path** — `config.py` now loads `.env` from `backend/` directory explicitly via `Path(__file__)`, avoiding CWD-dependent failures. (`backend/config.py`)
- **Frontend UI Redesign (Apple-Style)** — Complete design token system (~200 lines CSS), glass cards, gradient accent, Inter typography, 4-button system. All 6 pages redesigned. Built and deployed.
- **Monochrome Redesign (post-feedback)** — Apple palette rejected by user. Pivoted to pure black/white/gray, Helvetica Neue, dramatic type scale (body 18px, headline 64px), solid white accents. Rounded corners and glass transparency added after further feedback.

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

## Task — Frontend UI Redesign (Apple-Style)

**Date:** 2026-07-18
**Assigned to:** DeepSeek (Implementation Engineer)
**Design by:** Claude Opus 4.8 (Principal Architect)

### Goal

Replace the current utilitarian dark UI with an Apple-website-inspired design language: minimalist, typography-driven, generous whitespace, refined palette, subtle glass effects, smooth micro-interactions. The visual experience IS the product.

### Design Direction & Rationale

The current CSS (85 lines, flat `#0a0a0a` background, `#1a1a1a` cards, no type scale) works but has zero personality. The design-questions doc specifies: *"Minimalism, 100% loyal to yourself, Apple-style design."*

**What "Apple-style" means for this project:**

| Principle | What it looks like |
|---|---|
| Typography as hero | SF Pro Display for headlines — large, light-weight, tight letter-spacing. Body text restrained. The type *is* the design. |
| Generous whitespace | Content breathes. Sections separated by space, not rules. Padding is never tight. |
| Refined dark palette | Not `#0a0a0a` (pure black). Warm deep charcoal with subtle elevation layers. Apple's dark mode uses `#0d0d0f`. |
| Frosted glass | Cards use semi-transparent backgrounds + backdrop-blur. Creates depth without heavy shadows. |
| One accent, used sparingly | A gradient indigo→violet for interactive elements. Not shouting — whispering. |
| Micro-interactions | Hover states that feel physical. Smooth 0.2-0.3s transitions. Button press gives tactile feedback. |
| No decoration | Every element earns its place. No dividers unless content demands them. No emoji as structural elements. |

**The aesthetic risk:** A warm amber secondary accent — used only in one or two places (logo mark, a highlight). This prevents the "near-black + single purple accent" AI-default look. Music has both warmth (amber) and precision (indigo).

---

### 1. Design Token System

Replace all hardcoded colors and values with CSS custom properties in `:root`. Every component references tokens — never raw hex values.

```css
:root {
  /* ── Palette ──────────────────────────── */
  --bg-primary: #0d0d0f;          /* deepest background */
  --bg-secondary: #111114;         /* page background */
  --bg-elevated: #161618;          /* card, input backgrounds */
  --bg-glass: rgba(22, 22, 24, 0.7);  /* frosted glass cards */
  --bg-hover: #1c1c20;            /* card/row hover */

  --border-subtle: rgba(255, 255, 255, 0.06);  /* barely visible */
  --border-default: rgba(255, 255, 255, 0.08);
  --border-focus: rgba(129, 140, 248, 0.4);     /* accent ring */

  --text-primary: #f5f5f7;        /* headlines, body */
  --text-secondary: #a1a1a6;      /* secondary labels */
  --text-tertiary: #6e6e73;       /* muted, captions */
  --text-placeholder: #52525b;    /* input placeholders */

  --accent: #818cf8;              /* indigo — primary CTA */
  --accent-hover: #a5b4fc;        /* lighter indigo on hover */
  --accent-gradient: linear-gradient(135deg, #818cf8, #c084fc);  /* indigo → violet */
  --accent-warm: #f59e0b;         /* amber — sparingly, for warmth */

  --success: #34d399;             /* green — verified, imported */
  --warning: #fbbf24;             /* amber — attention */
  --error: #f87171;               /* red — destructive */

  /* ── Typography ───────────────────────── */
  --font-display: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace;

  /* Type scale (1.25 ratio) */
  --text-xs: 0.75rem;    /* 12px — captions, badges */
  --text-sm: 0.875rem;   /* 14px — secondary text */
  --text-base: 1rem;     /* 16px — body */
  --text-lg: 1.25rem;    /* 20px — section titles */
  --text-xl: 1.563rem;   /* 25px — card titles */
  --text-2xl: 1.953rem;  /* 31px — page headlines */
  --text-3xl: 2.441rem;  /* 39px — hero */

  /* ── Spacing ──────────────────────────── */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;

  /* ── Radii ────────────────────────────── */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  /* ── Shadows (subtle — dark mode) ──────── */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px rgba(129, 140, 248, 0.15);

  /* ── Transitions ──────────────────────── */
  --transition-fast: 0.15s ease;
  --transition-base: 0.25s ease;
  --transition-slow: 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);

  /* ── Layout ───────────────────────────── */
  --max-width-page: 1040px;
  --max-width-form: 420px;      /* narrower forms for focus */
}
```

---

### 2. Global CSS Rewrite (`index.css`)

**File:** `project/frontend/src/index.css`
**Action:** Replace entirely (currently 85 lines → ~200 lines).

Key changes from current:
- `body` background: `#0a0a0a` → `var(--bg-primary)`
- Inputs: flat dark → glass-style with focus ring
- Buttons: white → gradient accent for primary, glass for secondary
- Cards: `#111` + `1px solid #1a1a1a` → `var(--bg-glass)` + `backdrop-filter: blur(20px)` + `var(--border-subtle)`
- Links: gray `#888` → `var(--text-secondary)` with accent hover
- Container: `max-width: 960px` → `max-width: var(--max-width-page)`
- Add: utility classes for the type scale, a `.btn-ghost` variant, a `.badge` class

**Complete CSS spec — write this file verbatim:**

```css
/* ═══════════════════════════════════════════════════════════════
   Music-Self Design System
   Apple-inspired dark theme — v2 redesign
   ═══════════════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* ── Design Tokens ─────────────────────────────────────────── */

:root {
  --bg-primary: #0d0d0f;
  --bg-secondary: #111114;
  --bg-elevated: #161618;
  --bg-glass: rgba(22, 22, 24, 0.65);
  --bg-hover: #1c1c20;

  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.08);
  --border-visible: rgba(255, 255, 255, 0.12);
  --border-focus: rgba(129, 140, 248, 0.4);

  --text-primary: #f5f5f7;
  --text-secondary: #a1a1a6;
  --text-tertiary: #6e6e73;
  --text-placeholder: #52525b;

  --accent: #818cf8;
  --accent-hover: #a5b4fc;
  --accent-gradient: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
  --accent-warm: #f59e0b;

  --success: #34d399;
  --warning: #fbbf24;
  --error: #f87171;

  --font-display: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Inter', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.563rem;
  --text-2xl: 1.953rem;
  --text-3xl: 2.441rem;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 24px rgba(129, 140, 248, 0.12);

  --transition-fast: 0.15s ease;
  --transition-base: 0.25s ease;
  --transition-slow: 0.4s cubic-bezier(0.22, 0.61, 0.36, 1);

  --max-width-page: 1040px;
  --max-width-form: 420px;
}

/* ── Base ───────────────────────────────────────────────────── */

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: 1.6;
  min-height: 100vh;
}

/* ── Typography Helpers ─────────────────────────────────────── */

.text-xs  { font-size: var(--text-xs); }
.text-sm  { font-size: var(--text-sm); }
.text-base { font-size: var(--text-base); }
.text-lg  { font-size: var(--text-lg); }
.text-xl  { font-size: var(--text-xl); }
.text-2xl { font-size: var(--text-2xl); }
.text-3xl { font-size: var(--text-3xl); }

.text-secondary { color: var(--text-secondary); }
.text-tertiary  { color: var(--text-tertiary); }
.text-accent    { color: var(--accent); }
.text-success   { color: var(--success); }
.text-error     { color: var(--error); }

.font-light   { font-weight: 300; }
.font-regular { font-weight: 400; }
.font-medium  { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold    { font-weight: 700; }

/* ── Layout ─────────────────────────────────────────────────── */

.container {
  max-width: var(--max-width-page);
  margin: 0 auto;
  padding: 0 var(--space-6);
}

.container-narrow {
  max-width: var(--max-width-form);
  margin: 0 auto;
  padding: 0 var(--space-6);
}

/* ── Cards ──────────────────────────────────────────────────── */

.card {
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  transition: border-color var(--transition-base), transform var(--transition-base);
}

.card:hover {
  border-color: var(--border-visible);
}

.card-interactive {
  cursor: pointer;
}

.card-interactive:hover {
  border-color: var(--border-focus);
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow);
}

.card-selected {
  border-color: var(--accent);
  box-shadow: var(--shadow-glow);
}

/* ── Inputs ─────────────────────────────────────────────────── */

input, textarea, select {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: var(--text-base);
  width: 100%;
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

input::placeholder, textarea::placeholder {
  color: var(--text-placeholder);
}

input:focus, textarea:focus, select:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.15);
}

/* ── Buttons ────────────────────────────────────────────────── */

button, .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: var(--text-primary);
  color: var(--bg-primary);
  border: none;
  border-radius: var(--radius-full);
  padding: var(--space-3) var(--space-6);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  user-select: none;
}

button:hover, .btn:hover {
  opacity: 0.88;
  transform: translateY(-1px);
}

button:active, .btn:active {
  transform: translateY(0);
  opacity: 0.75;
}

button:disabled, .btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  transform: none;
}

/* Primary — gradient accent */
.btn-primary {
  background: var(--accent-gradient);
  color: #fff;
  font-weight: 600;
}

.btn-primary:hover {
  opacity: 0.92;
  box-shadow: var(--shadow-glow);
}

/* Secondary — glass outline */
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-visible);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--border-focus);
  opacity: 1;
}

/* Ghost — no border, subtle */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: none;
}

.btn-ghost:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  opacity: 1;
  transform: none;
}

/* Danger */
.btn-danger {
  background: transparent;
  color: var(--error);
  border: 1px solid transparent;
}

.btn-danger:hover {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.25);
  opacity: 1;
}

/* Sizes */
.btn-sm { padding: var(--space-1) var(--space-4); font-size: var(--text-xs); }
.btn-lg { padding: var(--space-4) var(--space-8); font-size: var(--text-base); }

/* ── Links ──────────────────────────────────────────────────── */

a {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

a:hover {
  color: var(--text-primary);
}

/* ── Spinner ────────────────────────────────────────────────── */

@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-default);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin: 0 auto;
}

.spinner-sm { width: 14px; height: 14px; border-width: 1.5px; }

/* ── Badge / Tag ────────────────────────────────────────────── */

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
}

.badge-accent {
  background: rgba(129, 140, 248, 0.12);
  color: var(--accent);
}

.badge-success {
  background: rgba(52, 211, 153, 0.12);
  color: var(--success);
}

.badge-warning {
  background: rgba(251, 191, 36, 0.12);
  color: var(--warning);
}

/* ── Divider ────────────────────────────────────────────────── */

.divider {
  height: 1px;
  background: var(--border-subtle);
  margin: var(--space-6) 0;
}

/* ── Empty State ────────────────────────────────────────────── */

.empty-state {
  text-align: center;
  padding: var(--space-12) var(--space-6);
  color: var(--text-tertiary);
}

.empty-state-icon {
  font-size: 2rem;
  margin-bottom: var(--space-4);
  opacity: 0.4;
}

/* ── Animations ─────────────────────────────────────────────── */

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes pulse-ring {
  0%, 100% { box-shadow: 0 0 0 0 rgba(129, 140, 248, 0.3); }
  50%      { box-shadow: 0 0 0 8px rgba(129, 140, 248, 0); }
}

.animate-fade-in {
  animation: fadeIn var(--transition-base) ease forwards;
}

.animate-fade-in-up {
  animation: fadeInUp 0.5s ease forwards;
}

/* ── Reduced motion ─────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* ── Scrollbar ──────────────────────────────────────────────── */

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border-visible);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}
```

---

### 3. Page-by-Page Redesign Specs

#### 3.1 — `Login.jsx`

**Current issues:** Tight 400px box, no breathing room, "music-self" is a plain h1, form feels cramped.

**New design:**
- Center the form vertically with `min-height: 100vh` flex centering
- "music-self" wordmark gets the gradient accent treatment — large, light-weight, with the amber dot as a small abstract mark
- Form inputs: glass-style with `var(--bg-elevated)`, taller padding (`14px 16px`), rounder (`--radius-md`)
- Button: full-width gradient primary
- "No account?" link: centered below, subtle
- On mount: content fades in (`animate-fade-in-up`)

**Key JSX changes:**
```jsx
<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  <div className="container-narrow animate-fade-in-up" style={{ width: '100%' }}>
    {/* Logo */}
    <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-2xl)',
        fontWeight: 300,
        letterSpacing: '-0.02em',
        background: 'var(--accent-gradient)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: 'var(--space-2)'
      }}>
        music-self
      </h1>
      <p className="text-sm text-tertiary">Your lens, made visible</p>
    </div>
    {/* Form card */}
    <div className="card" style={{ padding: 'var(--space-8)' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <input type="email" placeholder="Email address" ... />
        <input type="password" placeholder="Password" ... />
        <button type="submit" className="btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--space-2)' }} disabled={submitting}>
          {submitting ? <><span className="spinner spinner-sm"/> Signing in...</> : 'Sign in'}
        </button>
      </form>
    </div>
    <p style={{ textAlign: 'center', marginTop: 'var(--space-6)' }} className="text-sm text-tertiary">
      New to music-self? <a href="/signup" style={{ color: 'var(--accent)', fontWeight: 500 }}>Create an account</a>
    </p>
  </div>
</div>
```

**Remove:** `maxWidth: 400, marginTop: 80` approach. Replace with vertical centering + narrower container.

---

#### 3.2 — `Signup.jsx`

Same layout pattern as Login — vertical centering, glass card, gradient wordmark.

**Additional for signup flow:**

**Success state (post-signup):** Redesign the welcome card:
- Larger icon (64px), more breathing room
- Email displayed prominently
- Three scenarios rendered clearly:
  1. `verificationSent` → green badge "✓ Verification email sent" + Resend button (ghost style)
  2. `!verificationSent && verificationUrl` → amber warning with direct link in a subtle code-style box
  3. Neither → minimal warning, "Continue to Dashboard" as primary action
- "Go to Dashboard" → `btn-primary` (primary action)
- "Resend" → `btn-ghost` (secondary)

**Form state:** Same as Login but with 3 fields (email, password, confirm password).

**Copy changes:**
- "Sign up" → "Create account" (more Apple-like)
- Placeholder: "Email address" not "Email"

---

#### 3.3 — `Verify.jsx`

**Current issues:** Plain card with emoji icons, basic layout.

**New design:**
- Centered, same layout pattern as Login/Signup
- Each state (verifying/success/error) gets the full card treatment
- Verifying: subtle shimmer animation on the spinner
- Success: green checkmark icon (no emoji), "Your email is verified" headline, "Continue to Dashboard" gradient button
- Error: subtle red indicator, clear explanation, "Back to login" link

**Key changes:**
- Replace emoji `✅` / `❌` with CSS-styled status indicators (or clean SVG icons)
- The card should animate in with `fadeInUp`

---

#### 3.4 — `Dashboard.jsx` (largest file — ~610 lines)

This is the main page and needs the most work. Current issues:
- Too much content crammed into 960px
- Cards are flat `#111` squares
- QR section is functional but visually unrefined
- Playlist grid cards lack personality
- Analysis results are in a `#1a1a1a` box with no hierarchy
- Verification banner is a colored strip

**New layout structure (top to bottom):**

```
┌──────────────────────────────────────────────┐
│  Header bar (glass, sticky top)              │
│  [music-self]                    [Logout →]  │
├──────────────────────────────────────────────┤
│                                              │
│  Welcome section                             │
│  "Welcome, [nickname]"  (2xl, light)         │
│  "Your music landscape"  (secondary)         │
│                                              │
│  [Verification banner — if unverified]       │
│  (subtle glass strip, not a colored box)     │
│                                              │
│  ┌─ Connection card ───────────────────┐     │
│  │  [QR code area / Connected badge]    │     │
│  │  [Import Playlists button]           │     │
│  └──────────────────────────────────────┘     │
│                                              │
│  Playlist grid                               │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                │
│  │ ♪  │ │ ♪  │ │ ♪  │ │ ♪  │               │
│  └────┘ └────┘ └────┘ └────┘                │
│                                              │
│  ┌─ Detail panel (when selected) ───────┐    │
│  │  Playlist info + Analyze button      │    │
│  │  [Analysis results]                  │    │
│  │  [Track list]                        │    │
│  └──────────────────────────────────────┘    │
│                                              │
└──────────────────────────────────────────────┘
```

**Section-by-section changes:**

**Header:**
- Replace the `display: flex; justify-content: space-between` div with a proper glass header
- `position: sticky; top: 0; z-index: 10; background: var(--bg-glass); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border-subtle); padding: var(--space-4) var(--space-6);`
- Wordmark on left (smaller gradient text), Logout on right (btn-ghost)

**Welcome section:**
- Large "Welcome, {nickname}" in display font (text-2xl, light weight)
- Subtitle: "Your music landscape" in text-secondary
- More vertical space above and below

**Verification banner:**
- Current: `#1a1a2a` background with `border: 1px solid #a78bfa44`
- New: Glass card with subtle amber-left-border accent, smaller text, integrated "Resend" as a small text link (not a button)
- Should feel like a gentle reminder, not an alert

**Connection card (Netease QR):**
- QR image gets a white background card inside the glass card
- States remain the same (generating/waiting/scanning/connecting/expired) but each gets refined visuals:
  - Generating: spinner with "Preparing QR code..." caption
  - Waiting: QR image with the pulse-ring animation (why this is better than current `pulse` border animation)
  - Scanning: QR dims to 40% opacity, green check overlays
  - Expired: subtle error message with "Generate new code" btn-secondary
- Countdown timer: monospace font (`--font-mono`), smaller, below QR

**Playlist grid:**
- Cards get the full `.card-interactive` treatment
- Cover image: larger border-radius (12px), subtle inner shadow
- Playlist name: font-weight 500, truncates
- Track count: `text-xs text-tertiary`
- Selected state: gradient border glow (`.card-selected`)
- Hover: subtle lift + subtle glow

**Detail panel (when playlist selected):**
- Slides in with `animate-fade-in`
- Header: album cover (64px), playlist name, track count, Analyze button (`btn-primary`)
- Analysis results: refined layout with proper typography hierarchy
  - Vibe headline: `text-xl font-light` in accent color
  - Insight quote: italic, secondary color, left-border accent
  - Mood tags: `.badge-accent` styled pills
  - Metrics grid: 3-column with subtle glass backgrounds
  - Genre/artist lists: comma-separated, secondary color
- Track list: each row has hover state (glass highlight), album art thumbnail (40px), track name + artist, subtle bottom border

---

#### 3.5 — `Admin.jsx`

**Current issues:** Pure functional tables, no visual refinement. Stats cards work but feel generic.

**New design — same structure, refined styling:**

**Login screen:**
- Same centered layout as Login/Signup
- "Admin" headline with monospace styling (suggests technical/secure)
- Key input: monospace font, password type
- Button: `btn-primary`

**Dashboard (authenticated):**
- Header: same glass sticky bar pattern as main Dashboard
- Stats row: glass cards with large numbers in accent gradient
- Tables: each row is a glass strip (like Apple's Settings app rows)
  - Row hover: subtle highlight
  - Delete button: `btn-danger` (red, subtle — just the word, not a box)
  - Confirm state: inline buttons, danger highlighted
- Table headers: `text-xs`, uppercase, letter-spacing, tertiary color

---

### 4. Toast Component Update

**File:** `project/frontend/src/components/Toast.jsx`

**Current:** Colored strips with emoji prefixes.

**New:**
- Glass card style (backdrop-blur)
- Types map to our tokens: success=green left-border, error=red left-border, warning=amber left-border, info=accent left-border
- No emoji prefixes — use clean text + subtle left border color
- Slide-in from top-right with `fadeInUp`

---

### 5. Animation Specs

| Element | Trigger | Animation |
|---|---|---|
| Page content | On mount | `fadeInUp` (0.5s, staggered if multiple sections) |
| Card hover | Mouse enter | `translateY(-2px)` + `box-shadow: var(--shadow-glow)` (0.25s) |
| Card click | Mouse down | `scale(0.98)` (0.1s) |
| Button hover | Mouse enter | `translateY(-1px)` + subtle opacity change (0.15s) |
| Button press | Mouse down | `translateY(0)` (0.1s) |
| QR pulse ring | While waiting | `pulse-ring` animation (2s infinite) |
| Detail panel | On select | `fadeIn` (0.2s) |
| Toast | On show | Slide in from right (0.3s ease-out) |
| Modal/confirm | On show | `fadeIn` + scale from 0.95 |

---

### 6. Implementation Order

Do this in **one task, one file at a time**, in this order:

| Step | File | Effort |
|---|---|---|
| 1 | `frontend/src/index.css` | Replace entire file (~200 lines) |
| 2 | `frontend/src/pages/Login.jsx` | Rewrite JSX with new classes |
| 3 | `frontend/src/pages/Signup.jsx` | Rewrite JSX with new classes |
| 4 | `frontend/src/pages/Verify.jsx` | Rewrite JSX with new classes |
| 5 | `frontend/src/components/Toast.jsx` | Update styling |
| 6 | `frontend/src/pages/Dashboard.jsx` | Rewrite JSX (biggest — ~6 sections) |
| 7 | `frontend/src/pages/Admin.jsx` | Rewrite JSX |
| 8 | `frontend/` | `npm run build` to rebuild `dist/` |

**Each page must be tested locally** (npm run dev → localhost:5173) before moving to the next.

### 7. Acceptance Criteria

- [ ] Every page uses design tokens from `:root` — no raw hex values in JSX `style={}`
- [ ] Forms are vertically centered, with glass cards
- [ ] "music-self" wordmark uses gradient text on every page
- [ ] Buttons use `btn-primary` / `btn-secondary` / `btn-ghost` / `btn-danger` classes
- [ ] Cards have backdrop-blur glass effect
- [ ] Hover states feel physical (subtle lift + glow)
- [ ] Animations respect `prefers-reduced-motion`
- [ ] All 5 pages render correctly at 320px–1440px width
- [ ] No emoji used as structural UI elements (✅ → clean text + color)
- [ ] Login flow works end-to-end: signup → verify → login → dashboard
- [ ] QR login flow works: generate → scan → connect → import
- [ ] Playlist selection + analysis works with new card styles
- [ ] Admin panel works: login → view stats → delete/disconnect
- [ ] `dist/` rebuilt and tested before deploying

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
