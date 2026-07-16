# 🧭 Music-Self — Project Explained

## The Big Idea

**Music is how you perceive the world. Your lens, made visible.**

Music-Self is a web app where you connect your music account, import your playlists, and see yourself reflected in what you listen to. Not a dashboard with stats — a visual space that grows with you. Like bringing up a kid, not building a report.

---

## Architecture Overview (3 Servers)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Netease API │ ──> │  Flask API   │ ──> │  React UI    │
│  :3000       │     │  :5000       │     │  :5173       │
│  (Node.js)   │     │  (Python)    │     │  (Vite)      │
└──────────────┘     └──────────────┘     └──────────────┘
                           │
                     ┌─────┴──────┐
                     │  SQLite DB  │
                     │  database.db│
                     └────────────┘
```

### 1. Netease API Server (`localhost:3000`)
- A **Node.js** server that talks to Netease Cloud Music's real backend
- Provides endpoints like: QR login, fetch playlists, fetch tracks
- You run this separately by cloning the open-source `api-enhanced` repo
- Our Flask backend talks to it, never directly to Netease

### 2. Flask Backend (`localhost:5000`)
- Our main API — written in Python
- Handles: user accounts, Netease connection, playlist import
- Saves everything to a local SQLite file (`database.db`)
- The frontend talks only to this server

### 3. React Frontend (`localhost:5173`)
- What you see in the browser
- Three pages: Login, Signup, Dashboard
- Dark theme, Apple-minimal design
- Built with Vite (fast dev server)

---

## Project File Map

```
D:/music thera/
│
├── README.md              ← GitHub repo home page (what people see first)
├── CLAUDE.md              ← Full project documentation & history for AI agents
├── explain.md             ← This file — clear explanation of everything
├── .gitignore             ← Files Git should ignore
│
├── docs/                  ← GitHub Pages (public website)
│   ├── index.html         ← Landing page — "Your lens, made visible"
│   ├── story.html         ← The origin story — how we got here in 8 phases
│   └── progress.html      ← Technical progress tracker
│
├── project/               ← All the actual code lives here
│   │
│   ├── backend/           ← Flask API (Python)
│   │   ├── app.py             ← Entry point — starts the server, connects routes
│   │   ├── config.py          ← Settings from .env file
│   │   ├── models.py          ← Database tables (users, playlists, tracks, etc.)
│   │   ├── auth.py            ← Signup, login, logout (bcrypt passwords)
│   │   ├── netease_routes.py  ← QR code login & connection to Netease
│   │   ├── playlist_routes.py ← List & import playlists from Netease
│   │   ├── requirements.txt   ← Python packages needed
│   │   └── .env.example       ← Template for your config
│   │
│   ├── frontend/          ← React UI (JavaScript)
│   │   └── src/
│   │       ├── main.jsx           ← App entry point
│   │       ├── App.jsx            ← Router (login → signup → dashboard)
│   │       ├── api.js             ← How the frontend talks to Flask
│   │       ├── index.css          ← Global dark theme styles
│   │       └── pages/
│   │           ├── Login.jsx      ← Email + password login
│   │           ├── Signup.jsx     ← Create an account
│   │           └── Dashboard.jsx  ← Main page — QR login, import, playlist grid
│   │
│   ├── venv/              ← Python virtual environment (don't touch)
│   ├── design-questions.md ← The original design doc (answers to 8 questions)
│   ├── tasks.md           ← The task list DeepSeek followed to build this
│   └── setup.md           ← How to run everything
│
├── api-enhanced/          ← Netease API server (cloned from GitHub, not in Git)
│
└── *.pdf, *.epub          ← Reference books (music therapy, music processing)
```

---

## How Data Flows

### User signs up / logs in
```
Browser → POST /api/auth/signup → Flask hashes password → SQLite
                                 → Sets session cookie → Browser
```

### User connects Netease
```
Browser → GET /api/netease/qr/key → Flask → Netease API (:3000) → QR key
Browser → GET /api/netease/qr/create → QR code image
User scans with Netease phone app
Browser polls GET /api/netease/qr/check → Netease API → "scanned!"
Browser → POST /api/netease/connect {cookie} → Flask saves to SQLite
```

### User imports playlists
```
Browser → POST /api/playlists/import → Flask
  → Netease API: /user/playlist (get all playlists)
  → Netease API: /playlist/track/all (get tracks per playlist)
  → Saves everything to SQLite
  → Returns playlist list → Browser renders as cards
```

---

## What's in the Database

| Table | What it stores |
|---|---|
| `users` | Email + hashed password |
| `netease_tokens` | Netease login cookie (keeps you connected) |
| `playlists` | Your imported playlists (name, cover, track count) |
| `tracks` | Individual songs (name, artist, album, cover) |
| `playlist_tracks` | Which songs belong to which playlist |

---

## How to Run (3 Terminals)

### Terminal 1 — Netease API (port 3000)
```bash
cd /d/music\ thera/api-enhanced
node app.js
# → "Server started @ http://localhost:3000"
```

### Terminal 2 — Flask Backend (port 5000)
```bash
cd /d/music\ thera/project
source venv/Scripts/activate
python backend/app.py
# → "Running on http://localhost:5000"
```

### Terminal 3 — React Frontend (port 5173)
```bash
cd /d/music\ thera/project/frontend
npm run dev
# → "Local: http://localhost:5173"
```

Open `http://localhost:5173` in your browser.

---

## What's Next (Planned)

1. **Visual landscape** — the core feature: a garden/geometry that represents your taste
2. **Audio analysis with librosa** — extract tempo, key, energy from local audio files
3. **Social masks** — share a facet of your music-self with others
4. **iOS app** — native mobile version

## What We DON'T Do

- ❌ No ads
- ❌ No gamification, streaks, or pressure
- ❌ No AI explaining your emotions
- ❌ No p5.js
- ❌ No Spotify (they require Premium)
