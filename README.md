# 🌱 Music-Self

**Music is how you perceive the world. Your lens, made visible.**

You're not sharing a playlist. You're showing someone how you process reality.

---

## 📍 Current Status

| | |
|---|---|
| ✅ | **Live on Render** — `https://music-self.onrender.com` |
| ✅ | **V1 skeleton working** — Flask backend + React frontend live |
| ✅ | Sign up / login with bcrypt auth |
| ✅ | Netease Cloud Music QR login (5-state UX + countdown) |
| ✅ | Playlist import from Netease (parallel fetching, error-resilient) |
| ✅ | Admin endpoint / API key protected (`/api/admin?key=xxx`) |
| ✅ | QR login UX — generating/waiting/scanning/connecting/expired states |
| ✅ | Error handling — JSON-safe API client, informative error messages |
| ✅ | 2-server production stack: api-enhanced (Render Node) → Flask (Render Python) |
| 🧪 | Next: visual landscape, audio analysis, social features |
| 📖 | [Full progress page →](https://rex188.github.io/csmusic/progress.html) |

---

## 🚀 Try It Now

**→ [https://music-self.onrender.com](https://music-self.onrender.com)**

Connect your Netease Cloud Music account via QR code and import your playlists. No commitment, no data stored unless you sign up. Your music-self grows with you.

## 👁️ What Is Music-Self?

A private space where your music becomes a **living landscape** — one that reflects how you see the world. The way you hear music *is* the way you see everything else.

### The reframe

| ✗ Old (cringe) | ✓ New (sharp) |
|---|---|
| Discover yourself through music | **Music IS how you perceive the world** |
| Your emotional support garden | Your lens, made visible |
| Share your feelings | Share your perspective |
| The app understands you | You see yourself — and others see you too |

**Why sharing matters:** Consensus isn't agreeing on facts. It's recognizing a shared way of *perceiving*. If someone resonates with your lens, the connection is already deeper than small talk ever gets.

### Key features

- **🔍 Self-perception** — See the shape of your own lens. Patterns you'd never notice in a playlist.
- **🤝 Deep connection** — Show someone your music-self = show them how you process reality.
- **🎭 Facets, not profiles** — Social masks for different contexts. Different sides of you for different people.

### What none of the existing tools do

| Project | What it does | Missing |
|---|---|---|
| **Bloom** | Spotify → one-shot flower visualization | Doesn't evolve over time |
| **Sonosphere** | 3D world from listening behavior | No user reflection layer |
| **Soundgaze** | 3D similarity map of audio features | Cold — no relationship feel |
| **Spotify Wrapped** | Year-end stats | One moment, then gone |

**Music-Self fills this gap.** It grows with you. It incorporates your reflection. It feels like a relationship, not a snapshot.

---

## 🛠️ Tech Stack

| Layer | Tech | Deployed To |
|---|---|---|
| Backend | Flask (Python 3.11), SQLite, bcrypt sessions | Render (gunicorn) |
| Frontend | React + Vite, dark Apple-minimal CSS | Flask serves built static files |
| Music source | Netease Cloud Music API Enhanced (Node.js) | Render (separate service) |
| Admin | `/api/admin?key=xxx` + local CLI `python admin.py all` | Built-in |
| ML stack (ready) | librosa, numpy, scipy, scikit-learn, Streamlit | Local |
| AI workflow | DeepSeek (implementation) + Claude Opus (architecture) | — |

---

## 💬 Share your perspective

This is early. The direction is set, but every detail is negotiable.

📮 [Open a GitHub Issue](https://github.com/Rex188/csmusic/issues/new) — a thought, a critique, a wild idea. I read everything.

---

*Built by [Rex188](https://github.com/Rex188) — Your perspective matters.*
