# Music-Self V1 — Implementation Tasks

**Assigned to:** DeepSeek (Senior Implementation Engineer)
**Architecture by:** Claude Opus 4.8 (Principal Software Architect)
**Debugging by:** Debugger (Senior Debugging Engineer)
**Date:** 2026-07-16

**Status:** 🔵 **P1 — Inner Room redesign in progress.** Garden visual prototype (Phase 20) is live. P1 task (below) supersedes the garden — replacing flat 2D blobs with a 2.5D isometric room. See `inner-self-design.md` for the full theoretical foundation and 10 design decisions.

You are the implementer. **Read the spec fully before starting.** The design document at `project/inner-self-design.md` is the philosophical foundation — read it once so you understand WHY each decision was made. Then implement exactly what's specified below. If something is ambiguous or broken, flag it — don't improvise.

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
| `pages/Dashboard.jsx` | Main page: Netease QR connect (5 visual states), countdown timer, playlist import with spinner + success summary, playlist grid with clickable cards + detail panel (track list + Analyze button + LLM results), Garden visualization, `PlaylistCard` component inline. |
| `pages/Admin.jsx` | `/admin` page: key login, stats cards, User/Playlist/Netease tables with Delete/Disconnect + confirm dialog. |
| `pages/Verify.jsx` | `/verify?token=xxx` page: verifying/success/error states with auto-login. |
| `components/Toast.jsx` | Toast notification system. |
| `components/Garden.jsx` | React wrapper for p5 garden sketch. |
| `garden/sketch.js` | p5 instance mode: Cowsert animated noise bg + Houston blobs per playlist. |
| `garden/mapping.js` | LLM analysis fields → mood preset key mapping. |
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
- **Debugger audit + 9 bugfixes (2026-07-20)** — Full codebase audit identified 9 bugs (4 medium, 5 low). All fixed: Signup logo invisible (BUG-1), Dashboard resend false success (BUG-2), session cookie security (BUG-3), CORS configurability (BUG-4), import toast duration (BUG-5), page title (BUG-6), verification_url ordering (BUG-7), countdown timer (BUG-8), redundant SELECT (BUG-9). Full report in `bug.md`.

### ❌ Not Yet Built / ❌ Needs Rework
1. **Mind Garden (not built)** — dashboard is still card-based UI with a small 400px canvas box. The garden should be the primary visual layer (full-screen/dominant) with floating blobs, animated background, and UI overlaid as glass panels on top.
2. **Emotional Blob (built incorrectly)** — `renderer.js` creates near-rigid circles with insufficient noise distortion (~9%) and flat colors. Needs: larger noise amplitude (20-40%), radial/multi-color per layer, 64-128 sample points, and color variation driven by Perlin noise.
3. **Animated background (not built)** — background is solid `#000000` instead of the Simulated Feelings tile grid approach (geometric tiles flowing as colored bands, emotion-driven palette and motion).
4. **Garden API (too simple)** — `/api/analysis/garden` returns flat bloom list. Needs aggregate mood data (valence scores, dominant emotion, background_palette, motion_speed) to drive the background animation.
5. **Librosa audio analysis pipeline** — custom ML for tempo, key, energy from audio files
6. **Social masks** — sharing a facet of your music-self
7. **Optional journaling / notes** — attaching thoughts to songs
8. **iOS app** — postponed

### 🐛 Known Issues
1. **QR state persistence across users (partial fix in place).** sessionStorage now binds QR state to user ID, but on a shared machine, switching users can still show stale UI if the previous user's QR was in 'waiting' state before logout. Full fix needs proper per-user state cleanup on logout — deferred.
2. **Delete user then re-register works now** (fixed cascade deleting email_verifications).
3. ~~Email verification not available.~~ — **FIXED.** SMTP configured in `.env`. `verification_url` is now always returned (signup + resend), frontend shows clickable fallback link when SMTP fails. (2026-07-18)
4. ~~9 bugs from debugger audit (2026-07-20).~~ — **ALL FIXED.** See `bug.md` for details.
5. **Garden bugs — 8 open.** See `bug.md`. BUG-11 (moodToKey args swapped), BUG-12 (blob position smooth), BUG-13 (HSL off), BUG-14 (dead code), BUG-15 (blob stroke — FIXED), BUG-16 (CSS — no issue), BUG-17 (inline style — no issue), BUG-18 (StrictMode creates 2 canvases). Fix order: BUG-18 (cleanup not nulling ref) → BUG-11 (1 line swap) → BUG-12 (lerp).

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


---

# Debugger Audit — Full Project Inspection (2026-07-20)

**Inspected by:** Senior Debugging Engineer
**Files audited:** 28 source files across backend + frontend + config
**Scope:** Full codebase audit — bugs, regressions, security, edge cases, UX issues

---

## Medium Severity

---

### BUG-1: `--accent-gradient` removed but Signup.jsx success page still references it — logo invisible

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/Signup.jsx` |
| **Line** | 65-68 |
| **Type** | UI regression — visual defect |

**Description:**
The monochrome redesign (Phase 16) removed `--accent-gradient` from `index.css`, but Signup.jsx's success page still uses it for the "music-self" wordmark:

```jsx
background: 'var(--accent-gradient)',
WebkitBackgroundClip: 'text',
WebkitTextFillColor: 'transparent',
```

Since `--accent-gradient` is undefined, the `background` property falls through to `initial` (no background). Combined with `-webkit-text-fill-color: transparent`, the logo text becomes **invisible** against the dark background. Only the success page is affected — the form view of Signup, Login, and all other pages use `color: 'var(--text-primary)'` which renders correctly.

**Trigger:**
1. Sign up with any email/password
2. On success, the wordmark at the top of the page is invisible

**Evidence:**
- `index.css:0` (monochrome) — `--accent-gradient` is absent; only `--accent: #ffffff` and `--accent-hover: #cccccc` are defined
- Login.jsx:52 — uses `color: 'var(--text-primary)'` (correct)
- Dashboard.jsx:335 — uses `color: 'var(--text-primary)'` (correct)
- Verify.jsx:42 — uses `color: 'var(--text-primary)'` (correct)

**Minimal Fix:**
Replace the gradient styling with solid white to match all other pages:

```jsx
// In Signup.jsx, lines 65-68, change from:
background: 'var(--accent-gradient)',
WebkitBackgroundClip: 'text',
WebkitTextFillColor: 'transparent',

// To:
color: 'var(--text-primary)',
```

**Side Effects:** None — this brings the success page inline with the rest of the app's visual style.

**Confidence:** High

---

### BUG-2: Dashboard resend-verification button always shows success, ignores server response

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/Dashboard.jsx` |
| **Line** | 295-304 |
| **Type** | UX defect — misleading feedback |

**Description:**
The `handleResendVerification` function on the Dashboard ignores the response body from `resend-verification`. It always shows "Verification email resent!" — even when SMTP fails and no email was delivered.

The server returns `{"verification_sent": false, "verification_url": "..."}` on failure, but the frontend discards these values:

```javascript
await api.resendVerification();
addToast('Verification email resent!', 'success', 3000);
```

Compare with the Signup page's `handleResend` (`Signup.jsx:42-49`) which correctly reads `verification_sent` and `verification_url` from the response and shows the fallback URL when SMTP fails.

**Trigger:**
1. User signs up but no SMTP configured / SMTP down
2. User goes to Dashboard, sees verification banner, clicks "Resend"
3. Toast says "Verification email resent!" — email was NOT sent

**Evidence:**
- `Dashboard.jsx:295-304` — response body read but discarded (only used for toast message)
- `Signup.jsx:42-49` — correct implementation reads `verification_sent` and `verification_url`
- `backend/auth.py:185-191` — the resend endpoint returns `verification_sent` and `verification_url`

**Minimal Fix:**
Update `Dashboard.jsx:295-304` to handle the response the same way `Signup.jsx` does:

```javascript
const handleResendVerification = async () => {
  setResendingVerification(true);
  try {
    const result = await api.resendVerification();
    if (result.verification_url && !result.verification_sent) {
      addToast('Could not send email. Use the link displayed in the banner.', 'warning', 8000);
    } else {
      addToast('Verification email sent!', 'success', 3000);
    }
  } catch (err) {
    addToast(err.message, 'error');
  }
  setResendingVerification(false);
};
```

**Side Effects:** None — existing success path unchanged; failure path now shows warning instead of false success.

**Confidence:** High

---

### BUG-3: Missing session cookie security configuration for HTTPS production

| Field | Value |
|---|---|
| **File** | `backend/app.py` |
| **Line** | 9-10 |
| **Type** | Security hardening — production only |

**Description:**
Flask's session cookie is not configured for HTTPS. On Render (production), the app serves over HTTPS but the session cookie lacks the `Secure` flag. Additionally, `SESSION_COOKIE_SAMESITE` is not explicitly configured.

Without `SESSION_COOKIE_SECURE = True`:
- The cookie is transmitted over HTTPS (OK), but would also be transmitted over HTTP if accessed
- Some browsers/proxies may handle insecure session cookies differently
- Security scanners may flag this

**Evidence:**
- `backend/app.py:9-10` — only `app.secret_key = config.SECRET_KEY` is set
- No `app.config['SESSION_COOKIE_SECURE']` anywhere in the codebase
- The default in Flask < 3.0 is `False`; in Flask 3.0+ it uses `os.environ.get('SERVER_SOFTWARE', '').startswith('gunicorn')` to auto-detect

**Minimal Fix:**
After line 10 in `app.py`, add:

```python
app.config['SESSION_COOKIE_SECURE'] = os.getenv('RENDER') is not None or not app.debug
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY'] = True
```

**Side Effects:**
- On Render (HTTPS), cookies are now marked `Secure; SameSite=Lax; HttpOnly` — correct
- Local dev (HTTP): `Secure` cookies would be rejected by the browser, so the `os.getenv('RENDER')` guard is needed to only enable it on Render

**Alternative (safer):** Use `os.getenv('RENDER') is not None` explicitly, which is what the `is_dev` check on line 83 already does:

```python
app.config['SESSION_COOKIE_SECURE'] = os.getenv("RENDER") is not None
```

**Confidence:** High

---

### BUG-4: CORS origins hardcoded to localhost — production requests from external frontend rejected

| Field | Value |
|---|---|
| **File** | `backend/app.py` |
| **Line** | 11 |
| **Type** | Configuration — low risk currently |

**Description:**
`CORS(app, supports_credentials=True, origins=["http://localhost:5173"])` hardcodes allowed origins. In production on Render, the frontend is served by Flask (same-origin), so CORS is irrelevant for normal operation. However, if the API is ever accessed from:
- A browser extension / dev tool
- A separate frontend domain
- A mobile app

CORS will reject preflight requests. Additionally, `supports_credentials=True` with a single-origin whitelist is correct for Vite proxy mode, but the `localhost:5173` origin remains in production where it should be removed or made permissive for the Render domain.

**Minimal Fix:**
Make CORS origins configurable:

```python
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")
cors_origins = CORS_ORIGIN.split(",") if CORS_ORIGIN else ["http://localhost:5173"]
CORS(app, supports_credentials=True, origins=cors_origins)
```

Then in production, set `CORS_ORIGIN=https://music-self.onrender.com` in env vars, or remove the env var entirely (keep localhost-only for dev).

**Side Effects:** None — default behavior unchanged; production can configure as needed.

**Confidence:** High

---

## Low Severity

---

### BUG-5: Import toast has 17-minute duration — no programmatic dismiss on completion

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/Dashboard.jsx` |
| **Line** | 245 |
| **Type** | UX — minor |

```javascript
addToast('Importing your playlists... This may take a while.', 'info', 999999);
```

999999ms ≈ 16.7 minutes. The toast is never programmatically dismissed when import completes (line 249 creates a *new* success toast). The user must manually click the import toast to dismiss it. After import, there are 16 minutes of stale "Importing..." toast.

**Fix:** Make `addToast` return a dismiss function, or call `addToast` with a shorter duration and replace it on completion. Simplest: set duration to a reasonable max (e.g., 120000ms / 2 min) since the backend has 120s timeouts.

---

### BUG-6: `index.html` title is "frontend" instead of "music-self"

| Field | Value |
|---|---|
| **File** | `frontend/index.html` |
| **Line** | 6 |
| **Type** | Cosmetic |

```html
<title>frontend</title>
```

The Vite scaffold title was never updated. Browser tab shows "frontend" instead of "music-self". Affects all pages.

**Fix:** Change to `<title>music-self</title>`.

---

### BUG-7: `verification_url` computed after `send_verification_email()` — lost if SMTP throws

| Field | Value |
|---|---|
| **File** | `backend/auth.py` |
| **Line** | 55-60 |
| **Type** | Reliability — edge case |

**Current flow in signup (lines 45-66):**
```python
try:
    token = generate_token()
    expires = get_verification_expiry(24)
    conn.execute(...)  # Insert verification token
    conn.commit()
    conn.close()

    sent, smtp_error = send_verification_email(email, token)  # ← could throw
    verification_sent = sent
    app_url = config.APP_URL
    verification_url = f"{app_url.rstrip('/')}/verify?token={token}"  # ← never reached if SMTP throws
except Exception as e:
    print(...)
```

If `send_verification_email` raises an exception (not returns `(False, error)` — actually throws), the `verification_url` is never computed. The token was already committed to the database, so the user has a valid verification token but cannot access it.

In practice, `send_verification_email` catches its own SMTP exceptions and returns `(False, str(e))`, so it doesn't throw. But if the function is modified later, this is fragile.

**Fix:** Compute `verification_url` before sending the email:

```python
verification_url = f"{config.APP_URL.rstrip('/')}/verify?token={token}"
sent, smtp_error = send_verification_email(email, token)
verification_sent = sent
```

---

### BUG-8: Countdown timer starts at 300s but QR code is valid for ~180s

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/Dashboard.jsx` |
| **Line** | 74, 152 |
| **Type** | UX — cosmetic inconsistency |

- Initial state: `useState(180)` (3 min) — correct for QR expiry
- `startCountdown()`: `setCountdown(300)` (5 min) — mismatched

When the user clicks "Connect" after an expired QR, the timer jumps from 0:00 to 5:00. The actual QR expiry (server returns code 800) happens at ~3 min, so the countdown still shows 2:00+ when the QR expires. This is confusing.

**Fix:** Keep countdown consistent at 180 (3 min) across both the initial state and `startCountdown()`:

```javascript
const startCountdown = () => {
    setCountdown(180);  // was 300
```

---

### BUG-9: Redundant user_id query after INSERT in signup

| Field | Value |
|---|---|
| **File** | `backend/auth.py` |
| **Line** | 36-37 |
| **Type** | Performance — minor |

After INSERT, the code does `SELECT id FROM users WHERE email = ?` to get the user_id instead of using `cur.lastrowid`. The `cur` variable on line 31 captures the cursor but is never used.

**Fix:** Replace the SELECT with `cur.lastrowid`:

```python
cur = conn.execute("INSERT INTO users ...", ...)
conn.commit()
user_id = cur.lastrowid
```

---

## Observations (Non-Bugs)

---

### OBS-1: PostgreSQL SQL adapter is fragile

`backend/models.py:_convert()` (lines 319-331) uses simple string replacement to convert SQLite syntax to PostgreSQL:

```python
has_ignore = 'INSERT OR IGNORE' in sql      # substring match — fragile
sql = sql.replace('INSERT OR IGNORE', 'INSERT')
sql = sql.replace('?', '%s')                   # replaces ALL ? — breaks string literals
```

This works for the current 5-table schema but will break with:
- Any `?` inside string literals in SQL
- Any SQL that happens to contain `INSERT OR IGNORE` as a substring (unlikely but possible)
- Any SQLite syntax beyond `INSERT OR IGNORE` (e.g., `REPLACE INTO`, `INSERT OR REPLACE`)

Currently mitigated by:
- PostgreSQL is not used in production (SQLite is the primary target)
- All SQL uses simple parameterized queries

**Recommendation:** If PostgreSQL usage becomes necessary, replace the adapter pattern with proper SQLAlchemy or a more robust SQL translation layer.

---

### OBS-2: `_unwrap()` in netease_routes.py returns entire raw response on malformed API data

`netease_routes.py:34`: `inner = raw.get("body") or raw.get("data") or raw`

If the api-enhanced server returns a response with neither `body` nor `data`, the entire raw response is passed through. Downstream code calls `.get("code")` on this, which would work (returns `None` or the actual code from the response root). In practice, api-enhanced always wraps responses, so this is safe but fragile.

No fix needed — the `_unwrap` in `playlist_routes.py` (line 42-45) has the same pattern with the same behavior.

---

### OBS-3: Double connection close in auth.py error handler

`auth.py:64-66`:
```python
try:
    conn.close()
except Exception:
    pass
```

When the verification setup fails after `conn.close()` on line 53, the except handler tries to close again. This causes `sqlite3.ProgrammingError` (Cannot operate on a closed database) which is silently caught. Not harmful but worth cleaning up.

---

### OBS-4: No input validation for signup email domain / password strength

`auth.py:17-20`: Only checks for non-empty email and password. No email format validation, no password minimum length check. The frontend doesn't validate either (no `minLength` on password input).

**Risk:** Low — accounts are self-signup, no rate limiting on failed login attempts either.

---

### OBS-5: React StrictMode double-renders may cause duplicate API calls

`main.jsx:7` wraps App in `<StrictMode>`. In React 19 development mode, StrictMode double-invokes effects. The Dashboard's `useEffect` (mount) fires twice in dev, making two calls to `/api/me`, `/api/netease/status`, and `/api/playlists`. The side effect is duplicated work but no data corruption since all calls are GET.

This affects development only — production builds don't double-invoke.

---

## Critical Severity

---

### BUG-10: Garden architecture fundamentally misaligned with design spec

**Files:** `frontend/src/garden/renderer.js`, `frontend/src/components/GardenCanvas.jsx`, `frontend/src/pages/Dashboard.jsx`, `frontend/src/index.css`, `backend/analysis_routes.py:343-389`

**Root cause:** The garden was implemented as a secondary 400px canvas box within a conventional card-based page layout. The design spec calls for the garden to be the **primary visual layer** — full-screen, always visible, with floating blobs, animated background tile grid (Simulated Feelings by Cowsert), and UI overlaid as glass panels on top.


## Task — Inner Landscape Prototype (Cowsert + Houston port)

**Date:** 2026-07-20
**Architecture by:** Claude Opus 4.8 (Principal Software Architect)
**Assigned to:** DeepSeek (Senior Implementation Engineer)
**Reference source:** `docs/ref-simulated-feelings.html` (Cowsert) + `docs/ref-emotion-blob.html` (Houston)
**Dependency:** `npm install simplex-noise` (~2KB, zero transitive deps)

Port both reference p5.js sketches to monochrome Canvas 2D, then wire them to playlist analysis data.

**Pipeline:**
```
User clicks Analyze → LLM returns {energy, valence, mood_tags, ...}
                              │
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
  Cowsert bg             Houston blob           MindGarden trace
  (low opacity)          (per-playlist)         (permanent element)
  all playlists          one blob = one         one trace = one
  aggregate params       playlist's emo         analyzed playlist
```

---

### Part A: Emotion Preset Mapping

Our LLM analysis outputs text labels. These get mapped to the closest reference emotion preset, then the preset's numeric params drive the visuals. No user clicking — the data IS the selector.

#### Houston mapping

| Our LLM output | Maps to reference |
|---|---|
| valence = "euphoric" or "happy" | Joy preset |
| energy = "high" and valence = "sad" | Anxiety preset |
| valence = "sad" or "melancholic" | Sadness preset |
| energy = "low" and valence = "neutral" | Calm preset |
| Everything else | Interpolate between closest two |

Reference presets (from `ref-emotion-blob.html` line 38-75, adapted to monochrome):

```js
// Monochrome adaptation: hue/sat/light become white opacity values
const HOUSTON_PRESETS = {
  calm:    { breathAmp: 0.05, speed: 0.006, noiseAmp: 50,  opacity: 0.55, glowAlpha: 0.25 },
  joy:     { breathAmp: 0.11, speed: 0.01,  noiseAmp: 70,  opacity: 0.75, glowAlpha: 0.40 },
  anxiety: { breathAmp: 0.16, speed: 0.018, noiseAmp: 110, opacity: 0.60, glowAlpha: 0.35 },
  sadness: { breathAmp: 0.07, speed: 0.0025, noiseAmp: 40, opacity: 0.40, glowAlpha: 0.20 },
};
```

#### Cowsert mapping

| Our LLM output | Maps to reference |
|---|---|
| energy = "low" and calm moods | Calm preset |
| energy = "high" and energetic/upbeat moods | Overwhelmed preset |
| valence = "melancholic" or "nostalgic" in mood_tags | Nostalgic preset |
| energy = "high" and dark/intense moods | Anxious preset |
| Everything else | Interpolate between closest two |

Reference presets (from `ref-simulated-feelings.html` line 117-195, adapted to monochrome):

```js
const COWSERT_PRESETS = {
  calm:        { bands: 12, bendStrength: 0.18, jitter: 0.05, speed: 0.12, thickness: 0.03, microDensity: 0.2,  bgAlpha: 0.03, tileAlpha: 0.12 },
  anxious:     { bands: 18, bendStrength: 0.27, jitter: 0.11, speed: 0.20, thickness: 0.025, microDensity: 0.45, bgAlpha: 0.04, tileAlpha: 0.15 },
  nostalgic:   { bands: 10, bendStrength: 0.22, jitter: 0.06, speed: 0.11, thickness: 0.032, microDensity: 0.25, bgAlpha: 0.03, tileAlpha: 0.10 },
  overwhelmed: { bands: 22, bendStrength: 0.32, jitter: 0.14, speed: 0.24, thickness: 0.028, microDensity: 0.6,  bgAlpha: 0.05, tileAlpha: 0.18 },
};
```

---

### Part B: Three New Modules

Create directory: `frontend/src/garden/`

#### B1: `frontend/src/garden/mapping.js` — Emotion → Preset Logic

```js
/**
 * Map LLM analysis fields to Houston + Cowsert presets.
 * Returns { houston: {...}, cowsert: {...} }
 */
export function mapAnalysisToPresets(analysis) {
  const { energy, valence, mood_tags = [] } = analysis;
  const moods = mood_tags.map(t => t.toLowerCase());
  const moodStr = moods.join(' ');

  // --- Houston ---
  let houstonKey;
  if (valence === 'euphoric' || valence === 'happy') {
    houstonKey = 'joy';
  } else if (energy === 'high' && (valence === 'sad' || valence === 'melancholic')) {
    houstonKey = 'anxiety';
  } else if (valence === 'sad' || valence === 'melancholic') {
    houstonKey = 'sadness';
  } else if (energy === 'low' && valence === 'neutral') {
    houstonKey = 'calm';
  } else if (energy === 'high') {
    houstonKey = 'anxiety';
  } else {
    houstonKey = 'calm';
  }

  // --- Cowsert ---
  let cowsertKey;
  if (energy === 'low' && (moodStr.includes('calm') || moodStr.includes('chill') || moodStr.includes('peaceful'))) {
    cowsertKey = 'calm';
  } else if (energy === 'high' && (moodStr.includes('energetic') || moodStr.includes('upbeat') || moodStr.includes('euphoric'))) {
    cowsertKey = 'overwhelmed';
  } else if (moodStr.includes('nostalgic') || valence === 'melancholic') {
    cowsertKey = 'nostalgic';
  } else if (energy === 'high' && (moodStr.includes('dark') || moodStr.includes('intense') || moodStr.includes('angry'))) {
    cowsertKey = 'anxious';
  } else if (moodStr.includes('dreamy') || moodStr.includes('atmospheric') || moodStr.includes('introspective')) {
    cowsertKey = 'calm';
  } else {
    cowsertKey = 'calm';
  }

  return {
    houston: { key: houstonKey, ...HOUSTON_PRESETS[houstonKey] },
    cowsert: { key: cowsertKey, ...COWSERT_PRESETS[cowsertKey] },
  };
}

/**
 * Aggregate multiple per-playlist configs into one global Cowsert config.
 * Takes the average of numeric params from all presets.
 */
export function aggregateCowsert(configs) {
  if (configs.length === 0) return COWSERT_PRESETS.calm;
  const keys = ['bands', 'bendStrength', 'jitter', 'speed', 'thickness', 'microDensity', 'bgAlpha', 'tileAlpha'];
  const result = {};
  for (const k of keys) {
    result[k] = configs.reduce((s, c) => s + c[k], 0) / configs.length;
  }
  return result;
}

const HOUSTON_PRESETS = {
  calm:    { breathAmp: 0.05, speed: 0.006, noiseAmp: 50,  opacity: 0.55, glowAlpha: 0.25 },
  joy:     { breathAmp: 0.11, speed: 0.01,  noiseAmp: 70,  opacity: 0.75, glowAlpha: 0.40 },
  anxiety: { breathAmp: 0.16, speed: 0.018, noiseAmp: 110, opacity: 0.60, glowAlpha: 0.35 },
  sadness: { breathAmp: 0.07, speed: 0.0025, noiseAmp: 40, opacity: 0.40, glowAlpha: 0.20 },
};

const COWSERT_PRESETS = {
  calm:        { bands: 12, bendStrength: 0.18, jitter: 0.05, speed: 0.12, thickness: 0.030, microDensity: 0.20, bgAlpha: 0.03, tileAlpha: 0.12 },
  anxious:     { bands: 18, bendStrength: 0.27, jitter: 0.11, speed: 0.20, thickness: 0.025, microDensity: 0.45, bgAlpha: 0.04, tileAlpha: 0.15 },
  nostalgic:   { bands: 10, bendStrength: 0.22, jitter: 0.06, speed: 0.11, thickness: 0.032, microDensity: 0.25, bgAlpha: 0.03, tileAlpha: 0.10 },
  overwhelmed: { bands: 22, bendStrength: 0.32, jitter: 0.14, speed: 0.24, thickness: 0.028, microDensity: 0.60, bgAlpha: 0.05, tileAlpha: 0.18 },
};
```

---

#### B2: `frontend/src/garden/cowsert.js` — Background Field Renderer

Port of `ref-simulated-feelings.html` from p5.js to Canvas 2D, monochrome.

```js
import { createNoise2D } from 'simplex-noise';

/**
 * Create a Cowsert background renderer.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{ update(globalConfig): void, destroy(): void }}
 *
 * globalConfig = aggregateCowsert([perPlaylistCowsertConfigs...])
 */
export function createCowsert(canvas) {
  const ctx = canvas.getContext('2d');
  const noise2D = createNoise2D();
  let config = COWSERT_DEFAULTS;
  let bands = [];
  let animId = null;
  let globalTime = 0;
  let w = 0, h = 0;

  initBands();

  function initBands() {
    bands = [];
    for (let i = 0; i < config.bands; i++) {
      bands.push({
        seedPos: Math.random() * 1000,
        seedColor: Math.random() * 1000,
        seedJitter: Math.random() * 1000,
        baseOffset: (Math.random() - 0.5) * 0.7,
        thicknessFactor: 0.7 + Math.random() * 0.6,
        microBoost: 0.7 + Math.random() * 0.7,
      });
    }
  }

  function drawBand(band, cfg) {
    const marginX = w * 0.06;
    const marginY = h * 0.06;
    const x0 = marginX;
    const x1 = w - marginX;
    const y0 = marginY;
    const y1 = h - marginY;

    const base = (band.index + band.baseOffset) / (cfg.bands - 1) * (y1 - y0) + y0;
    const bandHeight = (y1 - y0) * cfg.bendStrength;
    const steps = Math.floor(50 + cfg.bands * 3);
    const speed = cfg.speed;

    for (let i = 0; i < steps; i++) {
      const u = i / (steps - 1);
      const uNext = (i + 1) / (steps - 1);

      const x = x0 + u * (x1 - x0);
      const xNext = x0 + uNext * (x1 - x0);

      const n = noise2D(band.seedPos + u * 2, globalTime * speed);
      const curveOffset = (n - 0.5) * bandHeight;

      const nj = noise2D(band.seedJitter + u * 4, globalTime * speed * 1.3);
      const jitterOffset = (nj - 0.5) * (y1 - y0) * cfg.jitter;

      const y = base + curveOffset + jitterOffset;

      const nNext = noise2D(band.seedPos + uNext * 2, globalTime * speed);
      const curveOffsetNext = (nNext - 0.5) * bandHeight;
      const njNext = noise2D(band.seedJitter + uNext * 4, globalTime * speed * 1.3);
      const jitterOffsetNext = (njNext - 0.5) * (y1 - y0) * cfg.jitter;
      const yNext = base + curveOffsetNext + jitterOffsetNext;

      const dx = xNext - x;
      const dy = yNext - y;
      const angle = Math.atan2(dy, dx);

      const segLen = (x1 - x0) / steps * (0.9 + Math.random() * 0.5);
      const baseThickness = (y1 - y0) * cfg.thickness * band.thicknessFactor;
      const alpha = cfg.tileAlpha * (0.7 + Math.abs(n) * 0.3);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // Main tile
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(-segLen / 2, -baseThickness / 2, segLen, baseThickness);

      // Micro-rect (confetti)
      if (Math.random() < cfg.microDensity * band.microBoost) {
        const microThick = baseThickness * (0.25 + Math.random() * 0.35);
        const microLen = segLen * (0.15 + Math.random() * 0.3);
        const microOffset = baseThickness * (Math.random() - 0.5) * 3.6;
        const microAlpha = alpha * 0.6;
        ctx.fillStyle = `rgba(255,255,255,${microAlpha})`;
        ctx.fillRect(
          segLen * (Math.random() - 0.5) * 0.4,
          microOffset,
          microLen,
          microThick
        );
      }

      ctx.restore();
    }
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    w = canvas.width / dpr;
    h = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Very subtle background fill
    ctx.fillStyle = `rgba(0,0,0,${1 - config.bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // Background confetti dots
    const cfg = config;
    const confettiCount = Math.floor(50 + cfg.microDensity * 120);
    for (let i = 0; i < confettiCount; i++) {
      const cx = w * 0.06 + Math.random() * w * 0.88;
      const cy = h * 0.06 + Math.random() * h * 0.88;
      ctx.fillStyle = `rgba(255,255,255,${cfg.tileAlpha * 0.15})`;
      ctx.fillRect(cx, cy, w * 0.006, h * 0.006 * (0.5 + Math.random() * 1.3));
    }

    for (const band of bands) {
      drawBand(band, config);
    }

    globalTime += 0.01;
    animId = requestAnimationFrame(draw);
  }

  animId = requestAnimationFrame(draw);

  return {
    update(newConfig) {
      // Smooth transition — if band count changed, re-init
      if (newConfig.bands !== config.bands) {
        config = { ...newConfig };
        initBands();
      } else {
        // Lerp numeric params toward new values
        const keys = ['bendStrength','jitter','speed','thickness','microDensity','bgAlpha','tileAlpha'];
        for (const k of keys) {
          config[k] += (newConfig[k] - config[k]) * 0.05;
        }
      }
    },
    destroy() {
      cancelAnimationFrame(animId);
    },
  };
}

const COWSERT_DEFAULTS = {
  bands: 12, bendStrength: 0.18, jitter: 0.05, speed: 0.12,
  thickness: 0.030, microDensity: 0.20, bgAlpha: 0.03, tileAlpha: 0.12,
};
```

---

#### B3: `frontend/src/garden/houston.js` — Per-Playlist Blob Renderer

Port of `ref-emotion-blob.html` from p5.js to Canvas 2D, monochrome. One blob per analyzed playlist.

```js
import { createNoise2D } from 'simplex-noise';

const LAYERS = 3;
const BLOB_POINTS = 240;

/**
 * Create a Houston blob renderer.
 * Manages MULTIPLE blobs — one per analyzed playlist.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{ update(blobs): void, destroy(): void }}
 *
 * blobs = [{ id, name, x, y, baseRadius: 60, preset }]
 */
export function createHoustonBlobs(canvas) {
  const ctx = canvas.getContext('2d');
  const noise2D = createNoise2D();
  let blobs = [];
  let animId = null;
  let w = 0, h = 0;

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    w = canvas.width / dpr;
    h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const time = performance.now() / 1000;

    for (const blob of blobs) {
      if (blob.opacity <= 0.02) continue; // skip fully transparent

      const p = blob.preset; // { breathAmp, speed, noiseAmp, opacity, glowAlpha }
      const { x, y, baseRadius } = blob;

      const t = time * p.speed;
      const scaleFactor = 1 + Math.sin(t) * p.breathAmp;
      const zoff = time * p.speed * 0.5;

      // Glow layer (shadowBlur)
      ctx.save();
      ctx.shadowBlur = baseRadius * 0.3;
      ctx.shadowColor = `rgba(255,255,255,${p.glowAlpha * blob.opacity})`;
      drawBlob(x, y, baseRadius, scaleFactor, zoff, p, blob.opacity);
      ctx.restore();

      // Main crisp layer
      ctx.save();
      ctx.shadowBlur = 0;
      drawBlob(x, y, baseRadius, scaleFactor, zoff, p, blob.opacity);
      ctx.restore();
    }

    animId = requestAnimationFrame(draw);
  }

  function drawBlob(cx, cy, baseRadius, scaleFactor, zoff, preset, masterOpacity) {
    for (let layer = 0; layer < LAYERS; layer++) {
      const tLayer = layer / (LAYERS - 1);
      const radius = baseRadius * (1 - tLayer * 0.18);
      const layerAlpha = (0.60 - tLayer * 0.25) * masterOpacity;
      const zShift = layer * 0.15;

      ctx.beginPath();
      for (let p = 0; p < BLOB_POINTS; p++) {
        const angle = (p / BLOB_POINTS) * Math.PI * 2;

        const xoff = Math.cos(angle) * 0.8 + 1 + zShift;
        const yoff = Math.sin(angle) * 0.8 + 1 + zShift;

        const n = noise2D(xoff, yoff + zoff + zShift);
        let r = radius + n * preset.noiseAmp;
        r *= scaleFactor;

        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);

        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      ctx.fillStyle = `rgba(255,255,255,${layerAlpha * 0.15})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${layerAlpha})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  animId = requestAnimationFrame(draw);

  return {
    update(newBlobs) {
      // Merge: existing blobs that match ID keep their position but update preset + opacity
      // New blobs get positioned and fade in
      const existingMap = new Map(blobs.map(b => [b.id, b]));
      blobs = newBlobs.map(nb => {
        const old = existingMap.get(nb.id);
        if (old) {
          return {
            ...nb,
            x: old.x + (nb.x - old.x) * 0.1,
            y: old.y + (nb.y - old.y) * 0.1,
            opacity: old.opacity + (1 - old.opacity) * 0.05,
            preset: { ...nb.preset },
          };
        }
        // New blob: start transparent
        return { ...nb, opacity: 0.01, preset: { ...nb.preset } };
      }).filter(b => b.opacity > 0.001);
    },
    destroy() {
      cancelAnimationFrame(animId);
    },
  };
}
```

---

### Part C: React Component + Dashboard Integration

#### C1: `frontend/src/components/Garden.jsx`

Single component that manages one shared Canvas + both renderers:

```jsx
import { useEffect, useRef, useCallback } from 'react';
import { createCowsert } from '../garden/cowsert';
import { createHoustonBlobs } from '../garden/houston';
import { mapAnalysisToPresets, aggregateCowsert } from '../garden/mapping';

/**
 * Props:
 *   analyses — array of { id, name, energy, valence, mood_tags, ... }  (per-playlist analysis data)
 *
 * Each analysis = one blob + one Cowsert config.
 * All Cowsert configs aggregate into one global background.
 */
export default function Garden({ analyses = [] }) {
  const canvasRef = useRef(null);
  const cowsertRef = useRef(null);
  const houstonRef = useRef(null);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }, []);

  // Init renderers once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement);

    cowsertRef.current = createCowsert(canvas);
    houstonRef.current = createHoustonBlobs(canvas);

    return () => {
      cowsertRef.current?.destroy();
      houstonRef.current?.destroy();
      observer.disconnect();
    };
  }, []);

  // Update on data change
  useEffect(() => {
    if (!analyses.length || !cowsertRef.current || !houstonRef.current) return;

    // Per-playlist: map each analysis → Houston blob + Cowsert config
    const houstonBlobs = [];
    const cowsertConfigs = [];

    const paddingX = canvasRef.current?.parentElement?.clientWidth * 0.15 || 60;
    const totalW = canvasRef.current?.parentElement?.clientWidth || 800;
    const totalH = canvasRef.current?.parentElement?.clientHeight || 400;
    const usableW = totalW - paddingX * 2;
    const gap = Math.min(usableW / Math.max(analyses.length, 1), 140);

    analyses.forEach((a, i) => {
      const { houston, cowsert } = mapAnalysisToPresets(a);
      houstonBlobs.push({
        id: a.id,
        name: a.name,
        x: paddingX + (i / Math.max(analyses.length - 1, 1)) * usableW,
        y: totalH * 0.5 + (Math.sin(i * 2.3) * totalH * 0.2),
        baseRadius: 50 + Math.random() * 20,
        preset: houston,
      });
      cowsertConfigs.push(cowsert);
    });

    // Global Cowsert = average of all per-playlist configs
    const globalCowsert = aggregateCowsert(cowsertConfigs);

    houstonRef.current.update(houstonBlobs);
    cowsertRef.current.update(globalCowsert);
  }, [analyses]);

  return (
    <div className="garden-container">
      <canvas ref={canvasRef} className="garden-canvas" />
      {analyses.length === 0 && (
        <div className="garden-empty">
          <p className="garden-empty-text">Analyze a playlist to grow your garden</p>
        </div>
      )}
    </div>
  );
}
```

---

### Part D: Backend + Dashboard Changes

#### D1: `backend/analysis_routes.py` — New endpoint

Add to `analysis_bp`:

```
GET /api/analysis/garden
```

Returns all completed analyses in garden-ready format:

```python
@analysis_bp.route("/garden", methods=["GET"])
def get_garden():
    uid, err = _require_auth()
    if err:
        return err

    conn = models.get_db()
    jobs = conn.execute("""
        SELECT aj.summary, p.id as playlist_id, p.name
        FROM analysis_jobs aj
        JOIN playlists p ON p.id = aj.playlist_id
        WHERE aj.user_id = ? AND aj.status = 'completed' AND aj.summary IS NOT NULL
        ORDER BY aj.completed_at ASC
    """, (uid,)).fetchall()
    conn.close()

    analyses = []
    for j in jobs:
        s = json.loads(j["summary"])
        vibe = s.get("vibe", "")
        if vibe.startswith("Analysis failed") or vibe.startswith("LLM not configured"):
            continue
        analyses.append({
            "id": j["playlist_id"],
            "name": j["name"],
            "energy": s.get("energy", ""),
            "valence": s.get("valence", ""),
            "mood_tags": s.get("mood_tags", []),
            "tempo_pace": s.get("tempo_pace", ""),
            "diversity": s.get("diversity", ""),
        })

    return jsonify({"analyses": analyses})
```

#### D2: `frontend/src/api.js` — Add 1 line

```js
getGarden: () => request('/analysis/garden'),
```

#### D3: `frontend/src/pages/Dashboard.jsx` — Add Garden

**Import:**
```js
import Garden from '../components/Garden';
```

**Add state:**
```js
const [gardenAnalyses, setGardenAnalyses] = useState([]);
```

**Fetch on mount** — add after `api.getPlaylists()`:
```js
try {
  const g = await api.getGarden();
  if (g.analyses) setGardenAnalyses(g.analyses);
} catch {}
```

**Fetch after analysis** — in `handleAnalyze`, after `setAnalysisResult`:
```js
try {
  const g = await api.getGarden();
  if (g.analyses) setGardenAnalyses(g.analyses);
} catch {}
```

**Add to JSX** — between verification banner and welcome section:
```jsx
<Garden analyses={gardenAnalyses} />
```

**Remove the old** `{/* ── Welcome section ── */}` subtitle "Your music landscape" — the garden IS the landscape.

#### D4: `frontend/src/index.css` — Garden styles

```css
/* ── Garden ────────────────────────────────────────────── */

.garden-container {
  position: relative;
  width: 100%;
  margin-bottom: var(--space-8);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: #000;
  border: 1px solid var(--border-subtle);
}

.garden-canvas {
  display: block;
  width: 100%;
  height: 420px;
}

.garden-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.garden-empty-text {
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: 300;
  color: var(--text-tertiary);
}

@media (max-width: 640px) {
  .garden-canvas { height: 280px; }
}
```

---

### Files Changed

| File | Action |
|---|---|
| `frontend/src/garden/mapping.js` | **NEW** — LLM analysis → preset mapping + aggregate |
| `frontend/src/garden/cowsert.js` | **NEW** — Port of ref-simulated-feelings.html, monochrome |
| `frontend/src/garden/houston.js` | **NEW** — Port of ref-emotion-blob.html, monochrome, multi-blob |
| `frontend/src/components/Garden.jsx` | **NEW** — React wrapper, one Canvas, two renderers |
| `backend/analysis_routes.py` | Add `GET /api/analysis/garden` (~25 lines) |
| `frontend/src/api.js` | Add `getGarden()` (1 line) |
| `frontend/src/pages/Dashboard.jsx` | Add Garden component + fetch (~10 lines) |
| `frontend/src/index.css` | Add garden styles (~30 lines) |

**New dependency:** `simplex-noise` (~2KB).

---

### Acceptance Criteria

- [ ] `GET /api/analysis/garden` returns analyses array with energy/valence/mood_tags per playlist
- [ ] After analyzing 1 playlist, Garden shows 1 Houston blob + Cowsert background
- [ ] After analyzing 3 playlists, Garden shows 3 blobs + aggregated Cowsert background
- [ ] Blob breathing speed matches playlist energy (high energy = fast breath)
- [ ] Blob noise/jaggedness matches playlist energy/diversity
- [ ] Cowsert bend strength + jitter change with playlist mood
- [ ] Cowsert background uses lowered opacity (bgAlpha ~0.03-0.05)
- [ ] All rendering is monochrome — white on black, no HSL colors
- [ ] New blobs fade in smoothly
- [ ] Canvas is retina-ready (devicePixelRatio)
- [ ] Canvas resizes with container
- [ ] Animation cleans up on unmount
- [ ] Empty state shows "Analyze a playlist to grow your garden"
- [ ] `npm run build` succeeds


---

## Task — P1: Inner Room (2.5D Isometric, Full-Screen)

**Date:** 2026-07-20
**Assigned to:** DeepSeek (Senior Implementation Engineer)
**Architecture by:** Claude Opus 4.8 (Principal Architect)
**Design document:** `project/inner-self-design.md` — read this first
**Prerequisite:** Current garden prototype must continue working until this task is complete and verified

### 0. What We're Building

Replace the current 400px garden canvas with a **full-screen 2.5D isometric room**. The room IS the product — UI floats on top as glass overlays.

**The current state (what exists):**

```
Dashboard page (card-based)
  ├── Header bar
  ├── Welcome text
  ├── Verification banner
  ├── QR connection card
  ├── Playlist grid
  ├── Detail panel (track list + analysis)
  └── Garden (400px canvas box, flat 2D)
        ├── Floating particles (white dots with noise walk)
        ├── Faint web lines between nearby particles
        └── Houston blobs (colored organic shapes, one per analysis)
```

**The target state (what we're building):**

```
Full-screen p5.js canvas (100vw × 100vh, behind everything)
  │
  ├── Layer 1: Room interior (2.5D isometric diorama)
  │     ├── Walls (back + left + right, isometric projection)
  │     ├── Floor (isometric plane, noise texture)
  │     ├── Window (on back wall, shows "outside" — emotional weather)
  │     ├── Shelf (on left/right wall, holds playlist objects)
  │     ├── Desk (center of floor or against back wall, holds diary objects)
  │     └── Door (on one wall — social entry/exit, V1: decorative only)
  │
  ├── Layer 2: Atmosphere (continuously flowing)
  │     ├── Light quality & color temperature
  │     ├── Dust particles (subtle, slow, light catches them)
  │     ├── Window weather (drawn on back wall window area)
  │     └── Ambient sound? (V1: skip — audio is P2)
  │
  ├── Layer 3: Abstract avatar (user's presence)
  │     └── Small point of light / soft glow, moves subtly
  │
  └── Layer 4: UI overlay (React DOM, glass panels)
        ├── Top bar: subtle profile/account indicator
        ├── Bottom floating buttons: +Music, +Diary
        ├── Diary panel: glass overlay, summoned/dismissed
        └── Playlist panel: glass overlay, shows grid + import
```

**Key visual references:**

| Element | Reference |
|---|---|
| Isometric room | Habbo Hotel rooms, Animal Crossing house interior, Monument Valley (but simpler) |
| Atmosphere | Inside a quiet room at golden hour / twilight — light matters more than objects |
| Color palette | Starts near-monochrome (grays, muted). Color emerges as user adds content. Empty room = mostly gray. |
| UI overlay | Apple Vision Pro glass panels — translucent, blurred, floating, minimal |

### 1. Core Architecture Decisions

These come from the design document. Do not change these.

| # | Decision | Implementation Impact |
|---|---|---|
| D1 | **2.5D pseudo-3D** | All 2D drawing on p5.js Canvas. Isometric projection via math (not Three.js). Walls are parallelograms. Depth is faked with draw order + shading. |
| D2 | **God's-eye isometric** | Camera angle: ~45° downward. Room is a diorama — user looks in from above. |
| D3 | **Dual-tempo** | Atmosphere renders every frame (light, weather, particles). Objects only re-draw on data change (walls, shelf items, desk items). |
| D4 | **p5.js instance mode** | Keep existing pattern (`new P5(sketch)`). One canvas. |
| D5 | **Gray start → earned color** | Empty state: room exists but is gray/desaturated. Each playlist import adds a small amount of color saturation to the room. Each diary entry adds warmth. |
| D6 | **Music = anchor signal** | Playlist analysis drives wall color tint, shelf objects, light temperature. Most weight in room appearance. |
| D7 | **Multiplicity over consistency** | Room doesn't average emotions into one color. Different corners of the room can feel different. Window weather ≠ wall tint ≠ shelf object color. |
| D8 | **Floating glass UI** | All UI panels are React DOM elements with `backdrop-filter: blur()` over the canvas. No UI drawn inside p5. |
| D9 | **Room = primary visual** | Canvas is `position: fixed; inset: 0; z-index: 0`. Everything else is `z-index > 0`. |
| D10 | **Avatar = abstract light** | A small glow/wisp in the room. Not a character. Not a photo. Moves subtly (slight noise-based drift). |

### 2. Isometric Projection Math

The room uses **isometric projection** — a specific form of axonometric projection where the three axes appear equally foreshortened. All p5 drawing uses these transforms.

```
Screen coordinates (sx, sy) from world coordinates (wx, wy, wz):

  sx = (wx - wy) * cos(30°)
  sy = (wx + wy) * sin(30°) - wz

Or simplified (cos30 ≈ 0.866, sin30 ≈ 0.5):

  sx = (wx - wy) * 0.866
  sy = (wx + wy) * 0.5 - wz

Where:
  wx = position along room width  (left-right)
  wy = position along room depth  (front-back)
  wz = height                     (floor to ceiling)
```

**Room coordinate system (wx, wy, wz):**

```
        WY (depth)
        /
       /
      /
     ┌──────────┐  ← back wall (wy = roomDepth)
     │  window  │
     │          │
     │  shelf   │  ← left wall (wx = 0)
     │          │
     │  door    │
     └──────────┘  ← front (wy = 0)
    WX (width)
```

**Room dimensions (world units, not pixels):**

```js
const ROOM = {
  width:  600,   // wx extent
  depth:  400,   // wy extent
  height: 350,   // wz extent (floor to ceiling)
  wallThickness: 8,
};
```

**Drawing order (painter's algorithm — back to front):**

1. Back wall (wy = depth, visible inside)
2. Window (on back wall)
3. Left wall (wx = 0, visible inside)
4. Right wall (wx = width, visible inside) — or skip for cleaner look
5. Shelf + shelf objects (against left wall)
6. Desk + desk objects (on floor, center or against back wall)
7. Floor (bottom plane)
8. Atmosphere particles (floating in room air)
9. Avatar light (on floor or desk area)

### 3. Empty State — The Gray Room

**Before any playlists or diary entries, the room renders as:**

```
┌──────────────────────────────────────────────┐
│                                              │
│   Back wall: dark gray (#1a1a1c)             │
│   with subtle noise texture (barely visible) │
│                                              │
│   ┌──────────────────┐                       │
│   │    window        │  ← dark outside       │
│   │    (black/gray)  │     no weather yet    │
│   └──────────────────┘                       │
│                                              │
│   Left wall: slightly darker gray (#141416)  │
│   ┌─ shelf (empty) ─┐                        │
│   │                  │                       │
│   └──────────────────┘                       │
│                                              │
│   Right wall: same as left                   │
│                                              │
│   Floor: dark (#111113)                      │
│   with very subtle noise grain               │
│   ┌─ desk (empty) ───┐                       │
│   │                   │                      │
│   └───────────────────┘                      │
│                                              │
│   Door: closed, dark outline                 │
│                                              │
│   Avatar: tiny white point on floor          │
│   Barely visible, like a candle              │
│                                              │
│   Atmosphere: minimal                         │
│   Very few dust particles                    │
│   Light: dim, cool white, from above         │
│                                              │
└──────────────────────────────────────────────┘
```

**Empty room parameters:**

```js
const EMPTY_ROOM_STATE = {
  // Wall colors (muted grays, very low saturation)
  wallColor:      { h: 240, s: 2,  l: 10  },  // near-black with hint of blue
  wallTexture:    0.3,                          // noise amplitude — barely visible
  
  // Floor
  floorColor:     { h: 240, s: 1,  l: 8   },  // slightly darker
  floorGrain:     0.15,
  
  // Window
  windowWeather:  'void',                       // dark, empty, no weather
  windowLight:    0.0,                          // no light coming through
  
  // Light
  ambientLight:   { h: 220, s: 5,  l: 15  },  // dim cool white
  lightAngle:     -60,                          // from ceiling-left
  
  // Objects
  shelfObjects:   [],
  deskObjects:    [],
  
  // Atmosphere
  dustCount:      8,
  dustSpeed:      0.02,
  
  // Avatar
  avatarGlow:     0.15,                         // very dim
  
  // Global saturation multiplier (0-1)
  // This is the key "earned vitality" parameter
  // Starts at 0, increases as user adds content
  saturationMul:  0.0,
};
```

### 4. Wall Rendering

Each visible wall is a filled polygon with optional noise-based texture overlay.

**Walls to draw (in order, back to front):**

1. **Back wall** — rectangle in isometric. Full width × full height.
2. **Left wall** — parallelogram. Full depth × full height, tapering with perspective.
3. **Right wall** — parallelogram. Same as left, on other side. (Optional: can be omitted for cleaner diorama look — implementer's choice after testing.)

**Wall drawing algorithm (per wall):**

```
function drawWall(vertices3D, baseColorHSL, noiseAmp):
  1. Project each 3D vertex to 2D screen via isoProject()
  2. Fill polygon with baseColorHSL
  3. Overlay: for each pixel in polygon bounds, sample simplex noise
     - noise value ∈ [-1, 1]
     - adjust pixel lightness by noise * noiseAmp * 8 (subtle)
     - creates subtle "plaster" texture
  4. Edge lines: slightly lighter than base, 0.5px, for definition
  
  Note on performance: sampling noise per-pixel on a large wall is expensive.
  Alternative: pre-render a noise texture to an offscreen p5.Graphics at
  lower resolution (1/4 scale), then draw it over the wall polygon with
  blendMode or alpha. This is how Cowsert works in the current garden.
```

### 5. Floor Rendering

The floor is the most visible surface — it takes up the largest area of the canvas. It needs to feel like a real surface (wood, stone, something textured) but rendered entirely with 2D noise.

**Approach:** Use the existing Cowsert noise-band technique but constrained to an isometric floor plane.

```
function drawFloor(vertices3D, floorColorHSL, grainAmplitude):
  1. Project floor plane (4 corners in 3D → 4 corners in 2D)
  2. Create offscreen p5.Graphics for floor texture
     - Size: floor pixel area at 1/4 resolution
     - Fill with base floor color
     - Apply noise grain: for each pixel, adjust lightness by
       simplexNoise(x * grainScale, y * grainScale) * grainAmplitude * 10
     - Draw subtle lines/seams (like floorboards) — optional, V1 can skip
  3. Draw the texture onto the main canvas clipped to floor polygon
     - Use p5 createGraphics + image() with texture mode
     - Or: use canvas clipping (p.save → beginShape → clip → draw → restore)
```

**Floor polygon (3D vertices → screen):**

```
  Front-left:   (0,         roomDepth, 0)  → screen
  Front-right:  (roomWidth, roomDepth, 0)  → screen
  Back-right:   (roomWidth, 0,         0)  → screen
  Back-left:    (0,         0,         0)  → screen

  This creates a diamond-like quad in isometric view.
```

### 6. Window + Weather

The window is an opening on the back wall. "Weather" outside represents the user's current/recent emotional state.

**Window structure:**

```
Back wall
┌────────────────────────────────────┐
│                                    │
│     ┌──────────────────────┐       │
│     │                      │       │  ← window frame (slightly lighter than wall)
│     │   "outside" view     │       │  ← weather content drawn inside
│     │                      │       │
│     └──────────────────────┘       │
│                                    │
└────────────────────────────────────┘
```

**Window drawing:**

1. Draw back wall first
2. Draw window opening: a darker rectangle inset in the back wall (simulates depth)
3. Draw weather content inside the opening, clipped to window bounds
4. Draw window frame: thin lighter border around the opening
5. Draw window crossbars: 2 horizontal + 2 vertical thin lines dividing the window into panes

**Weather types (driven by aggregate music mood):**

All weather is rendered with 2D noise — no particle systems, no physics. Just layered noise fields with different parameters.

```js
const WEATHER_PRESETS = {
  void: {     // Empty state — no music yet
    bg: { h: 240, s: 2, l: 4 },
    layers: [],  // nothing
  },
  clear: {    // Calm, peaceful, neutral
    bg: { h: 210, s: 10, l: 60 },
    layers: [
      { noiseScale: 0.003, speed: 0.01, alpha: 0.3, lShift: +5 },  // faint cloud wisps
    ],
  },
  rain: {     // Melancholic, sad, contemplative
    bg: { h: 220, s: 15, l: 25 },
    layers: [
      { noiseScale: 0.008, speed: 0.03, alpha: 0.5, lShift: -3 },  // rain streaks (diagonal noise)
      { noiseScale: 0.02,  speed: 0.01, alpha: 0.2, lShift: -5 },  // heavier drops
    ],
  },
  storm: {    // Intense, angry, anxious
    bg: { h: 230, s: 10, l: 15 },
    layers: [
      { noiseScale: 0.015, speed: 0.06, alpha: 0.6, lShift: -8 },  // fast diagonal streaks
      { noiseScale: 0.04,  speed: 0.04, alpha: 0.4, lShift: -10 }, // turbulence
    ],
  },
  fog: {      // Dreamy, ethereal, mysterious
    bg: { h: 200, s: 8, l: 45 },
    layers: [
      { noiseScale: 0.001, speed: 0.005, alpha: 0.6, lShift: +10 }, // slow rolling fog
      { noiseScale: 0.002, speed: 0.008, alpha: 0.3, lShift: +5 },
    ],
  },
  golden: {   // Warm, happy, joyful, nostalgic
    bg: { h: 35, s: 40, l: 55 },
    layers: [
      { noiseScale: 0.002, speed: 0.008, alpha: 0.25, lShift: +15 }, // warm glow drift
      { noiseScale: 0.005, speed: 0.012, alpha: 0.15, lShift: +10 },
    ],
  },
  overcast: { // Bittersweet, tender, reflective
    bg: { h: 225, s: 8, l: 50 },
    layers: [
      { noiseScale: 0.002, speed: 0.006, alpha: 0.5, lShift: +2 },
      { noiseScale: 0.006, speed: 0.010, alpha: 0.3, lShift: -2 },
    ],
  },
};
```

**Weather rendering algorithm:**

```
function drawWeather(weatherPreset, windowBounds, time):
  For each layer in weatherPreset.layers:
    1. Create offscreen texture at 1/4 window resolution
    2. For each pixel (x, y):
       n = simplexNoise(x * layer.noiseScale, y * layer.noiseScale, time * layer.speed)
       l = weatherPreset.bg.l + n * layer.lShift
       pixel = HSLtoRGB(weatherPreset.bg.h, weatherPreset.bg.s, l)
       Set pixel alpha = layer.alpha * 255
    3. Draw texture scaled up into window bounds
  
  Weather changes smoothly: lerp between current and target weather params
  over ~3 seconds when the aggregate mood changes.
```

**Weather mapping (aggregate music → weather type):**

```js
function moodToWeather(analyses) {
  // Aggregate all playlist analyses into one weather type
  // Most common emotional direction wins
  // If no analyses: 'void'
  // Map existing mapping.js mood keys to weather types
}
```

### 7. Shelf + Playlist Objects

The shelf sits against the left wall. Each analyzed playlist becomes an object on the shelf.

**Shelf drawing:**

```
Left wall side, isometric:
  
   ┌────────────────────┐  ← top shelf board (wood tone)
   │  [obj1] [obj2] ... │  ← objects sit on this
   ├────────────────────┤  ← middle shelf board
   │  [obj3] ...        │
   └────────────────────┘  ← bottom shelf board
  
   Multiple horizontal levels (V1: 2 shelves)
   Each shelf is a thin parallelogram in isometric
   Shelf color: warm dark wood (#2a2018 → { h: 30, s: 20, l: 14 })
```

**Playlist objects:**

Each analyzed playlist becomes a small abstract object on the shelf. Not a literal CD case or book — an abstract geometric form whose size, shape, and color come from the analysis.

```js
const OBJECT_FORMS = ['cube', 'sphere', 'pyramid', 'cylinder', 'crystal'];

function playlistToShelfObject(analysis, index) {
  const { energy, valence, mood_tags, track_count, name } = analysis;
  
  // Form: deterministic from playlist name hash (so same playlist = same shape)
  const formIndex = hashString(name) % OBJECT_FORMS.length;
  
  // Size: proportional to track count (clamped 0.6–1.4)
  const size = clamp(track_count / 50, 0.6, 1.4) * BASE_OBJECT_SIZE;
  
  // Color: from mood (same mapping as current blobs, but desaturated for shelf objects)
  const moodHue = moodToHue(mood_tags[0] || 'neutral');
  const saturation = 15 + energyLevel(energy) * 15;  // 15-30 — very muted
  const lightness  = 40 + valenceLevel(valence) * 15;  // 40-55
  
  // Glow: subtle, from inside the object
  const glowAmount = 0.05 + energyLevel(energy) * 0.1;
  
  return {
    id: analysis.id,
    name,
    form: OBJECT_FORMS[formIndex],
    position: { x: 0, y: index * OBJ_SPACING, z: SHELF_HEIGHT },  // world coords
    size,
    color: { h: moodHue, s: saturation, l: lightness },
    glow: glowAmount,
    opacity: 1.0,  // fade in when new
  };
}
```

**Object rendering:**

Each object is a small 2D drawing using basic shapes — the isometric projection means a "cube" is a hexagon, a "sphere" is a circle with shading, etc. All drawn at ~40-60px size. Use p5 `drawingContext.shadowBlur` for the internal glow, same technique as current Houston blobs.

**New objects fade in:** opacity starts at 0, increments 0.03 per frame until 1.0.

**Hover:** Object name tooltip (same pattern as current blob tooltips in sketch.js).

**Click:** Opens playlist detail (same `onBlobClick` pattern from Garden.jsx, renamed).

### 8. Desk + Diary Objects

The desk sits on the floor — small table/isometric box near the center or against the back wall. Each diary entry leaves a small object or mark on the desk.

**Desk drawing:**

```
Isometric box (top face + 2 visible side faces):
  
     ┌──────────────┐  ← desk top (lighter — wood or white)
    /│              │
   / │              │  ← front face
  └──┴──────────────┘
  
  Approx 30% of floor width, centered
  Height: ~15 world units
```

**Diary objects:**

When user writes a diary entry, it leaves a small mark on the desk. V1: a small folded paper rectangle or a glowing ink drop. Minimal — the diary system itself (floating glass panel, LLM analysis) is P2. V1 only needs the visual placeholder.

**V1 desk objects:** Each diary entry = small rectangle (like a folded note). Color: warm (sepia/cream). With very subtle text-like lines drawn on top (just a few horizontal noise lines — illegible, looks like handwriting from far away).

### 9. Lighting System

The room's light comes from ambient + directional sources. All lighting is computed as HSL adjustments to base colors.

```js
const LIGHTING = {
  ambient:  { h: 220, s: 5,  l: 12 },  // base fill light — cool dim
  key:      { h: 35,  s: 20, l: 60 },  // main directional — warm
  keyAngle: -60,                         // degrees (from upper-left in screen space)
};

function applyLighting(baseHSL, surfaceNormal, position3D) {
  // Simple Lambertian diffuse
  const lightDir = angleToDirection(LIGHTING.keyAngle);  // { x, y, z }
  const NdotL = max(0, dot(surfaceNormal, lightDir));
  
  // Blend ambient + key * NdotL
  const l = lerp(
    LIGHTING.ambient.l,
    LIGHTING.key.l,
    NdotL * 0.6  // key light influence capped at 60%
  );
  
  return { ...baseHSL, l };
}
```

**For V1, simplify:** walls have baked-in lighting (pre-computed HSL per wall vertex). Only objects and floor get dynamic lighting. The key light direction influences:
- Which side of objects is brighter
- Floor gradient (darker near walls, lighter near center)
- Shadow of shelf cast onto left wall (simple: darken wall below shelf by 5% lightness)

### 10. Avatar — Abstract Presence

A small point of light or soft glow on/near the floor. Represents the user's presence in their own room.

```
function drawAvatar(time, saturationMul):
  Position: center of floor, slightly off-center with noise drift
  
  Draw:
    1. Core: small circle (3-4px radius), white at 80% opacity
    2. Inner glow: slightly larger circle (6-8px radius), white at 20% opacity
    3. Outer glow: shadowBlur-based, white at 8% opacity, 15px blur
  
  Drift: position moves smoothly via 2D noise
    x += (noise(time * 0.3, 0) - 0.5) * 0.3
    y += (noise(0, time * 0.3) - 0.5) * 0.3
  
  Opacity: 0.15 at empty state, increases with saturationMul (up to 0.6)
  Size: proportional to saturationMul (3px → 5px radius)
```

### 11. Atmosphere Layer

Subtle ambient effects that make the room feel alive — continuously animated, independent of user data changes.

**Dust particles:**

```js
// 8-40 particles floating in room air (count = 8 + saturationMul * 32)
// Each particle:
//   - World position: random within room bounds
//   - Slow drift: 3D noise-based movement
//   - Render: project to screen, draw as tiny circle
//   - Opacity: 0.03–0.10 (very subtle)
//   - Size: 1–2px
//   - Brighter near window light, dimmer in corners
```

**Light shimmer:** A very subtle "breathing" of the ambient light — `ambientLight.l` oscillates by ±1 over ~8 seconds via sine. Barely perceptible. Makes the room feel alive even when nothing is happening.

### 12. Room State Model

The room's visual parameters are computed from user data. This is the data flow:

```
User data (from API)          Visual parameter            Change speed
─────────────────────         ─────────────────           ────────────
analyses.length                saturationMul              instant → lerp over 2s
aggregate mood (all)           window weather             lerp over 3s → continuous
aggregate energy (all)         dustCount, dustSpeed       instant
aggregate valence (all)        ambientLight warmth        lerp over 5s
per-playlist analysis          shelf object (color/form)  instant (position lerp)
diary entries count(V1: mock)  desk objects               instant
(V1: no diary yet)             desk = empty               —
music aggregate genre          wall tint shift            lerp over 30s (very slow)
```

**The saturation multiplier — earned vitality:**

```js
function computeSaturationMul(analysesCount, diaryCount) {
  // Each analyzed playlist adds ~0.08 saturation
  // Each diary entry adds ~0.03 saturation
  // Max saturation: 1.0 (reached at ~12 playlists + some diaries)
  // Or: 0 playlists → 0.0, 5 playlists → 0.4, 10 playlists → 0.7, 15+ → 1.0
  
  const fromMusic = Math.min(1.0, analysesCount * 0.08);
  const fromDiary = Math.min(0.3, diaryCount * 0.03);
  return Math.min(1.0, fromMusic + fromDiary);
}
```

This multiplier is applied to:
- Wall color saturation (e.g., `wallColor.s * saturationMul`)
- Floor color saturation
- Object glow intensity
- Avatar brightness
- Dust particle count
- Window weather vibrancy

**Lerping between states:**

All visual transitions are smooth. Use the same pattern as current blob position lerp (0.08 factor per frame). Target values are set instantly; rendered values approach targets asymptotically.

```js
// In draw loop:
currentWallSaturation += (targetWallSaturation - currentWallSaturation) * 0.02;
currentAmbientLight    += (targetAmbientLight    - currentAmbientLight)    * 0.03;
// etc.
```

### 13. Button System (Glass Overlay Layer)

These are React DOM elements, NOT p5 drawings. Positioned with CSS over the canvas.

**Floating action buttons (bottom-right area of screen):**

```
┌──────────────────────────────────────┐
│                                      │
│                                      │
│                                      │
│                        ┌──────────┐  │
│                        │  + Music │  │  ← glass pill button
│                        └──────────┘  │
│                        ┌──────────┐  │
│                        │  + Diary │  │  ← glass pill button
│                        └──────────┘  │
└──────────────────────────────────────┘
```

Button styles (use existing CSS token classes):
- `btn-secondary` variant — transparent bg with white border
- `backdrop-filter: blur(12px)`
- Rounded pill shape
- Icon + text: "+" and label
- Hover: border brightens, subtle lift

**+Music button:** Opens playlist panel (reuses existing Dashboard playlist import flow, but rendered as a glass overlay instead of a page section).

**+Diary button:** Opens diary input overlay (P2 — V1 can be a disabled/non-functional button, or opens a placeholder "coming soon" toast).

### 14. UI Overlay Architecture

All interactive UI lives in React DOM above the canvas. The canvas is purely visual.

```
z-index stack:
  z-0:  p5 canvas (room + atmosphere + objects)
  z-10: Top status bar (profile indicator, connection status)
  z-20: Floating action buttons (+Music, +Diary)
  z-30: Glass panels (diary input, playlist panel, analysis results)
  z-40: Toast notifications
```

**Glass panel component (new reusable component):**

```jsx
// GlassPanel — wraps content in a frosted-glass overlay
// Props: visible, onClose, title, children, width, position ('center' | 'right' | 'bottom')
//
// When visible:
//   - Darkens room slightly (backdrop with rgba(0,0,0,0.3))
//   - Slides in panel from position direction
//   - Panel: var(--bg-glass), backdrop-blur(24px), rounded, shadow
//   - Close button: top-right X
//   - Content area: scrollable
//
// Transition: fade + slide, 0.3s ease
```

### 15. Files — What Changes

| File | Action | Description |
|---|---|---|
| `frontend/src/garden/room.js` | **NEW** | Room sketch — replaces sketch.js. Contains: p5 instance setup, isometric projection helpers, wall/floor/window rendering, shelf/desk/object drawing, lighting, atmosphere particles, avatar. |
| `frontend/src/garden/mapping.js` | **MODIFY** | Add `moodToWeather()`, `computeSaturationMul()`, `playlistToShelfObject()`. Keep existing `mapAnalysisToPresets()` for backward compat during transition. |
| `frontend/src/garden/sketch.js` | **KEEP** | Don't delete — keep as fallback reference. Room is in `room.js`. |
| `frontend/src/components/Garden.jsx` | **MODIFY** | Rename to `Room.jsx` OR keep name and change internals. New: full-screen canvas (100vw × 100vh), imports `room.js` instead of `sketch.js`, adds UI overlay layer with glass buttons + panels. |
| `frontend/src/pages/Dashboard.jsx` | **MODIFY** | Replace Garden component usage. Move playlist/analysis UI into glass overlay panels triggered by the +Music button. Keep all existing API calls and state management — just re-house the UI. |
| `frontend/src/components/GlassPanel.jsx` | **NEW** | Reusable glass overlay panel component (frosted, blurred, animated in/out). |
| `frontend/src/api.js` | **NO CHANGE** | Existing endpoints are sufficient for V1 room data. |
| `backend/analysis_routes.py` | **NO CHANGE** | `/api/analysis/garden` endpoint already returns `analyses[]` — this is all the room needs. |
| `frontend/src/index.css` | **MODIFY** | Add `.room-canvas` (full-screen, z-0), `.glass-panel` styles, action button positioning, update garden styles → room styles. |
| `project/inner-self-design.md` | **NO CHANGE** | Reference document only. |

### 16. Implementation Order

Do this in sequence. Test each step before moving to the next.

| Step | What | Verification |
|---|---|---|
| **1** | Create `room.js` with p5 instance, isometric projection helpers, and draw the **empty room** (back wall + left wall + floor only, no objects, no weather). Canvas: full-screen, fixed position, z-0. | Open app → see gray isometric room on full screen. All existing UI (Dashboard cards etc.) visible on top. |
| **2** | Add **window + weather** rendering. Implement `moodToWeather()` in mapping.js. Window on back wall. Weather responds to `analyses` prop (or stays 'void' if empty). | After analyzing a playlist, window weather changes. Rain for melancholic, golden for happy, etc. |
| **3** | Add **lighting system** — ambient + key directional light. Apply to walls and floor. Add light shimmer (sine oscillation). | Room has depth — walls have light/dark sides. Light breathes subtly. |
| **4** | Add **shelf + playlist objects**. Implement `playlistToShelfObject()`. Objects appear on shelf when analyses exist. New objects fade in. Hover shows name. Click fires callback. | Import + analyze playlists → objects appear on shelf. Each has unique form and color. |
| **5** | Add **desk** (3D box on floor) + placeholder diary objects (static — just 1-2 folded paper shapes for visual completeness). No diary input yet. | Room has a desk with some visual presence. |
| **6** | Add **avatar** — small glowing point on floor with noise drift. Brightness responds to `saturationMul`. | User sees "themselves" as a point of light in the room. |
| **7** | Add **atmosphere** — dust particles, light shimmer (already done in step 3). Particle count scales with saturation. | Room feels alive even when idle. |
| **8** | Implement **saturation multiplier** — `computeSaturationMul()` drives wall/floor/object saturation. Room starts gray, gains color with each analysis. | Empty room = gray. 5 analyses = noticeably more color. 15 = full color. |
| **9** | Refactor **Dashboard.jsx** — move playlist import + grid + analysis into a GlassPanel triggered by +Music button. Keep all existing functionality. | Click +Music → glass panel slides up with playlist grid. Import/analyze still works. Results still show. |
| **10** | Create **GlassPanel** component. Use in step 9 and for future diary panel. | Reusable glass overlay with slide animation and backdrop-blur. |
| **11** | Add **+Diary button** (V1: shows "coming soon" toast or opens a minimal GlassPanel with a textarea — implementer's choice based on whether backend diary endpoint exists). | Button is present. Doesn't break anything. |
| **12** | **Full integration test** — start empty, import playlists, analyze them, watch room fill. All existing features still work (QR login, playlist import, analysis, admin). | End-to-end: gray room → colored room. No regressions. |
| **13** | **`npm run build`** — rebuild dist for deployment. | Build succeeds with no errors. |

### 17. Acceptance Criteria

**Room rendering:**
- [ ] Canvas fills entire viewport (`position: fixed; inset: 0`)
- [ ] Isometric room is recognizable — walls, floor, window, shelf, desk, door
- [ ] Room draws from back to front (painter's algorithm — back wall first, floor last)
- [ ] 60fps minimum on a mid-range machine (no dropped frames from per-pixel noise)
- [ ] Room resizes with window (ResizeObserver → canvas resize)
- [ ] All drawing is within p5 — no DOM elements inside canvas

**Empty state:**
- [ ] First visit shows gray isometric room with empty shelf, empty desk, dark window
- [ ] Avatar is a tiny dim light point
- [ ] Atmosphere is minimal (few dust particles, dim light)

**Music → room connection:**
- [ ] Importing + analyzing a playlist changes room: window weather updates, saturation increases, shelf object appears
- [ ] 3+ analyzed playlists → 3+ distinct shelf objects with different forms/colors/sizes
- [ ] All visual transitions are smooth (lerp, not snap)
- [ ] Saturation multiplier increases with each analysis (gray → warm by ~12 playlists)

**UI overlay:**
- [ ] +Music and +Diary buttons float above canvas (glass-style, z-indexed)
- [ ] +Music opens playlist panel as glass overlay with backdrop-blur
- [ ] Existing QR login / playlist import / analysis all work inside glass overlay
- [ ] Toast notifications render above glass panels

**Degradation / edge cases:**
- [ ] If `analyses` prop is empty array, room shows empty state (not crash)
- [ ] If canvas parent is not yet mounted, p5 setup waits (existing pattern)
- [ ] No duplicate canvas from React StrictMode (existing fix must still work)
- [ ] Playlist import without analysis: shelf stays empty (only analyzed playlists become objects)

**No regressions:**
- [ ] Signup / login / verify flow works
- [ ] QR connect / disconnect works
- [ ] Playlist import works
- [ ] LLM analysis works
- [ ] Admin panel works
- [ ] All existing API endpoints return correct data
- [ ] `npm run build` succeeds

### 18. What NOT to Build (P2+)

These are explicitly out of scope for P1. Do not implement:

- Diary input system (floating text panel with LLM analysis) — P2
- Ambient sound texture — P2
- Social features (door to other rooms, visiting, chat) — P3
- Mood tracking UI — P2
- Object interaction beyond hover tooltip + click — P2
- Multiple rooms per user — P2
- Mobile responsive layout (desktop-first for now)

---

## ✅ Completed

### Phase 22 — Docs Redesign & Landscape Within Essay

- [x] Create Aeon/New Yorker inspired typography design system (Source Serif 4 + Inter)
- [x] Shared `style.css` with light/dark mode, adaptive measure, responsive layout
- [x] Redesign `index.html` — clean landing with hero + card grid
- [x] Redesign `story.html` — project history in new typography
- [x] Redesign `progress.html` — stats, tasks, activity log
- [x] Publish "Landscape Within" essay as `interior.html`
- [x] Fix interior.html nav (brand link, navigation to all pages)
- [x] Restore missing article-specific CSS (img, figure, headings, footer)
- [x] Type scale refinement (body 20→18px, H1 52→44px)
- [x] Index hero CTA → prototype link
