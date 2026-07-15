# CS + Music Therapy — Project Setup

Welcome to the project. Read this file first to catch up.

## Project Location

```
D:/music thera/
```

## Two-Model Workflow

| Model | Role | Launch Script | Role File |
|---|---|---|---|
| **DeepSeek** | Senior Implementation Engineer | `project/deepseek.sh` | `project/ds role.md` |
| **Claude (Opus 4.8)** | Principal Software Architect | `project/claude.sh` | `project/claude role.md` |

**Rule:** Architecture first (Opus) → Implementation (DeepSeek). GPT was removed (2026-07-15) due to cost. Research advising is now part of Claude's architect role. No redesigning. Minimal changes only.

## Scripts Explained

### `project/deepseek.sh`
- Sets ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_MODEL to point at DeepSeek API
- Runs `claude` CLI with `ds role.md` as the system prompt
- Role: Implementation Engineer — do not redesign, just implement

### `project/claude.sh`
- Clears all proxy env vars
- Activates venv, prints `claude role.md`, launches bare Claude CLI
- Role: Principal Architect

## Python Environment

- **Python:** 3.11.9
- **Venv:** `project/venv/`
- **Activate:** `source project/venv/Scripts/activate` (Git Bash) or `project\venv\Scripts\activate` (cmd)
- **Installed packages:** librosa, numpy, scipy, scikit-learn, matplotlib, seaborn, streamlit, jupyter, pymupdf (and their dependencies)

## What Has Been Done

1. Project folder and Python virtual environment created
2. `requirements.txt` written with all core dependencies
3. Two-model workflow defined — 2 `.sh` launcher scripts, 2 `role.md` system prompts (GPT removed 2026-07-15 due to cost)
4. All shell scripts syntax-verified and functional
5. CLAUDE.md created with full docs and timeline
6. PyMuPDF installed for PDF text extraction from reference books

## What Has NOT Been Started

- **No actual CS + music therapy code has been written**
- No algorithms, prototypes, or experiments
- The user is still exploring, no specific project direction decided yet
- Deep research report was read and discussed (2026-07-15). The "emotion reflection" framing was explicitly rejected as unconvincing. Three alternative directions identified: (1) MIR/feature extraction, (2) feature-informed music generation, (3) clinical tools for practitioners.

## Reference Books Available

- *Defining Music Therapy* — Bruscia (theory foundation)
- *Handbook of Neurologic Music Therapy 2ed* — Thaut 2025 (clinical)
- *This Is Your Brain on Music* — Levitin (neuroscience)
- *Fundamentals of Music Processing* (CS/music analysis)
- *Affective Computing* — Picard (emotion + HCI)

## What NOT to Do

- Do NOT mention or suggest p5.js. The user explicitly rejected it.
- Do NOT redesign the project architecture — that's Opus's job.
- Keep changes minimal. Explain every modification.

## Timeline

| Date | Event |
|---|---|
| 2026-07-15 | Project initialized. Folder set up as CS + music therapy workspace. |
| 2026-07-15 | Python venv created, all packages installed. |
| 2026-07-15 | Three-model workflow defined with roles. Scripts and role prompts created. |
| 2026-07-15 | All shell scripts verified working. |
| 2026-07-15 | **Architect session documented.** Claude Opus 4.8 confirmed as Principal Software Architect; the project remains setup-only, with no selected direction or implemented CS + music therapy code. |
| 2026-07-15 | **GPT removed.** Three-model workflow reduced to two-model (Claude + DeepSeek). GPT was too expensive; research advising folded into Claude's architect role. `gpt.sh` and `gpt role.md` kept on disk but deprecated. |
| 2026-07-15 | **Deep research report reviewed.** Report proposed "emotion reflection system"; user rejected the framing — people don't need a machine to explain their own music choices. Three alternative directions identified: MIR feature extraction, feature-informed generation, and clinical tools for practitioners. Full discussion recorded in CLAUDE.md. |
| 2026-07-15 | Project state saved to memory for cross-session continuity. |

---

*For latest updates, check the timeline in CLAUDE.md.*
