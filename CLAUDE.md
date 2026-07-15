# CS + Music Therapy

Project workspace at `D:/music thera`.

## Two-Model Setup

| Model | Role | Script | Role File |
|---|---|---|---|
| **DeepSeek** | Senior Implementation Engineer | `project/deepseek.sh` | `project/ds role.md` |
| **Claude (Opus 4.8)** | Principal Software Architect | `project/claude.sh` | `project/claude role.md` |

**Architecture → Implementation** pipeline. Opus designs the architecture, DeepSeek implements. GPT was removed (2026-07-15) due to cost — research advising is now handled by Claude as part of the architect role.

## Structure

```
D:/music thera/
├── project/                  # Python project directory
│   ├── requirements.txt      # Core deps (librosa, numpy, scipy, sklearn, etc.)
│   ├── venv/                 # Python 3.11 virtual environment (activated)
│   ├── .gitignore
│   ├── deepseek.sh           # Script: launches DeepSeek with ds role.md
│   ├── claude.sh             # Script: launches Claude with claude role.md
│   ├── gpt.sh                # Script: launches GPT with gpt role.md
│   ├── ds role.md            # Implementation Engineer system prompt
│   ├── claude role.md        # Architect system prompt
│   └── gpt role.md           # Research Advisor system prompt
├── *.pdf / *.epub            # Reference books (music therapy, music processing, affective computing) (not in git)
├── docs/                     # GitHub Pages (public)
│   ├── index.html            # Landing page — Music-Self concept
│   └── progress.html         # Progress tracker
├── README.md                 # GitHub repo front page
├── .gitignore
└── CLAUDE.md
```

## Python Environment

- **Python:** 3.11.9
- **Venv:** `D:/music thera/project/venv/`
- **Activate:** `source project/venv/Scripts/activate` (Git Bash) or `project\venv\Scripts\activate` (cmd)
- **Key libs:** librosa, numpy, scipy, scikit-learn, matplotlib, seaborn, streamlit, jupyter, pymupdf

## Discussions

### 2026-07-15 — Project direction after deep research report

**User:** Read the deep research report. Why should people understand their emotions through music? Very few people care. They feel sad and listen to their favorite songs — that's common sense. Explaining this to users would be nonsense.

**Claude (Architect):** Agreed with the pushback. The report's core premise — "let me explain your emotions to you through your music" — is a solution looking for a problem. People already know why they listen to what they listen to. That framing doesn't work for a consumer product.

Three directions that *do* have genuine utility:

1. **Music feature extraction (MIR).** Can you extract tempo, key, timbre, emotional valence, energy level from audio in a way that's accurate and interpretable? A legitimate CS signal-processing problem.
2. **Feature-informed music selection/generation.** If you know what makes a piece sound a certain way, you can find or generate music with those properties — useful for therapy, focus, exercise, film scoring.
3. **Tools for practitioners, not consumers.** Music therapists do analysis and selection manually. A tool that helps *them* — the professionals — is solving a real problem for real people.

**Status:** No direction decided. The "emotional reflection" framing from the research report was rejected as unconvincing. The genuine CS problems are in signal processing, feature-informed retrieval/generation, and clinical tools.

### 2026-07-15 — Music-Self App direction chosen

**User** proposed a new concept: a private, introspective app where your music taste IS your identity. Core thesis: music is not just sounds — it's a reflection of how you perceive the world.

Key design decisions:
- **Metaphor:** A garden/landscape that grows over time, like bringing up a kid. Inspired by SOUL (Pixar).
- **No pressure.** No streaks, no guilt, no obligation to check in.
- **Visual-first.** Apple-style minimalism. Deep analysis happens under the hood — users see the garden, not charts.
- **Social masks.** Sharing shows a facet of your music-self. Different masks for different people.
- **Music from streaming APIs** (Spotify). Offline supported but secondary.
- **Web-first, then iOS.** Simple email/password accounts.
- **Research references:** n-gen art Bloom, Sonosphere, Soundgaze. None of them evolve over time or incorporate user reflection — that's the gap.

**Design decisions documented in `project/design-questions.md`.**

**Status:** Direction locked. Frontend-first V1. Architecture blueprint is the next deliverable.

---

## Timeline

| Date | Event |
|---|---|
| 2026-07-15 | **Project initialized.** Folder `D:/music thera` set up as CS + music therapy workspace. |
| 2026-07-15 | **Python environment created.** Virtual environment at `project/venv/`. `requirements.txt` with all core libs installed (librosa, numpy, scipy, sklearn, matplotlib, seaborn, streamlit, jupyter). PyMuPDF added later for PDF text extraction. |
| 2026-07-15 | **Three-model workflow defined.** DeepSeek (implementation), Claude/Opus (architecture), GPT (research). Each has a `.sh` launcher script and a `role.md` system prompt. |
| 2026-07-15 | **Role prompts created.** `ds role.md`, `claude role.md`, `gpt role.md` written and moved into `project/`. |
| 2026-07-15 | **Shell scripts verified.** All three `.sh` files pass syntax check; venv activation and role file reading confirmed working. |
| 2026-07-15 | **Architect session documented.** Claude Opus 4.8 confirmed as Principal Software Architect; the project remains setup-only, with no selected direction or implemented CS + music therapy code. |
| 2026-07-15 | **GPT removed.** Three-model workflow reduced to two-model (Claude + DeepSeek). GPT was too expensive; research advising folded into Claude's architect role. `gpt.sh` and `gpt role.md` kept on disk but deprecated. |
| 2026-07-15 | **Music-Self direction decided.** Design questions answered in `project/design-questions.md`. Concept locked. |
| 2026-07-15 | **GitHub Pages published.** Landing page + progress page live at `rex188.github.io/csmusic/`. |
