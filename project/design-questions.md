# Music-Self App — Design Decisions

Answer these. Free-form, short answers, whatever feels right. Skip nothing.

---

## 1. Input & Data

**a) Where does the music come from?**
- the mainstream music apps; collect the playlists'

**b) What's the unit?**
- users can set their preferences. If they prioritize one singer / one album...
- we will use ML to make a general assumption and a "classification"

**c) What metadata matters?**
- audio 
- when did you put it in
- how often do you listen to
- how'd know this

---

## 2. Identity Model

**a) One "music-self" or many?**
- One evolving self over time?
- it's like bringing up a kid

**b) Is it persistent or ephemeral?**
- Grows forever, like a garden?

**c) What does the user DO after the first visit?**
- I DONT want any PRESSURE. They dont have to do anything. They are not ordered to do anything.
- but they should have their own avatar?
- inspiration from the movie "SOUL" will be really good

---

## 3. Visual Form

**a) What's the metaphor?**
- Garden / landscape?

  

- Abstract geometry (shapes, colors)?

  

**b) How does music feature → visual element?**
For example: tempo → size? energy → brightness? valence → color warmth? key → shape?
 still need to decide.

**c) Static or interactive?**



- It changes / reacts as you scroll
- want it to be interactive

**d) Dark, light, or both?**

---

## 4. Audio Feature Extraction

**a) How deep do we go on music analysis?**

- Deep: train/use emotion models, segment analysis, genre classifiers?\
- I think this is very important though we dont have to let users know we did those analysis.
- this is for us to acc know the figure of the user.
- it will be very important to do the music-emotion link.
- this is how we make users feel : "this app really understand me"

**b) Does the user see any technical details?**



- Optionally, if they dig deeper.

  

---

## 5. Reflection & Meaning

**a) What does "self-discovery" actually mean here?**
- The user recognizes themselves in the visual — no text, no analysis.

- The app gently points out patterns ("you've added a lot of quiet music lately").

- i dont want users to be forced to write something.

- If they want to say something about the music / their daily life. we can accept that.

- these texts will be an important part of there "personalities"

  

**b) Should the app ever prompt the user?**

- Gentle nudges ("it's been a while — your garden misses you").

  

**c) Is there any writing or journaling?**

- Optional — you can attach notes to songs if you want.

- notes are encouraged with a reward system but not mandatory. 

  

---

## 6. Social & Sharing

**a) V1 — anything social at all?**

- i will say it's pretty much like snapchat

**b) What does sharing actually share?**
- The visual landscape?
- The playlist itself?
- you are sharing your "self" with others.
- and you can choose to show what part of your self. Maybe we can have social masks,

**c) Does sharing require consent on both sides?**

not really.

---

## 7. Platform & Tech

**a) What platform for V1?**
- i wanna do it all platform
- but web first? then mobile(ios)

**b) Offline-capable or always-online?**

​	always online

**c) User accounts?**

- Simple accounts (email + password).

---

## 8. Scope & Vibe

**a) What's the feeling we want?**
minimalism, 100% loyal to yourself, up to your own choice. vibe can change with ur emotions...

well designed apple style UI and frontend design

**b) What absolutely should NOT be in this?**
- No ads
- No force
- No lots of pop ups

**c) What's the smallest version that still feels like the real thing?**
still deciding? maybe music analysis

---

## 9. Discussion Log (2026-07-15)

### Core Concept

A **private, introspective space** where your music taste IS your identity. Not a social network. Not a dashboard. A visual landscape that grows and evolves as you add music — like bringing up a kid. No pressure, no streaks, no guilt.

**Thesis:** Music is not just sounds. It's a reflection of how you perceive the world.

### Key References

| Source | What it does | What to steal |
|---|---|---|
| **n-gen art (Bloom)** | Spotify data → flower visualization. Each petal = artist/genre. Color/size from audio features. | Garden metaphor proven. Music → plant works visually. |
| **Sonosphere** | Spotify data → interactive 3D world from listening *behavior* (repetition, exploration, time, curation). | Behavior shapes landscape, not just what you listen to but *how*. |
| **Soundgaze** | Spotify listening → 3D point cloud. UMAP on audio features. Similar songs = near each other. | Similarity-as-proximity is intuitive and powerful. |
| **SOUL (Pixar)** | Souls as abstract proto-personalities that develop through experience. | Perfect metaphor — your music-self is *becoming*, not finished. |

### What's Missing From Existing Tools

- **None evolve over time.** They're one-shot snapshots. Nobody has built the "growing kid" version.
- **None incorporate user reflection.** Purely data-driven. No optional journaling layer.
- **None feel like a relationship.** You generate, share, move on. The app doesn't feel *alive*.

### Architecture Direction

- **Frontend-first.** The visual experience IS the product. Apple-style minimalism, dark mode, interactive.
- **Music from streaming APIs** (Spotify primarily). Offline files supported but not the main path.
- **Deep analysis is for the app, not the user.** Heavy ML happens under the hood so the garden feels accurate. Users never see charts or numbers unless they choose to dig deeper.
- **Social masks.** Sharing shows a *facet* of your music-self, not the whole thing. Different masks for different people — like how you show different sides of yourself to different people in real life.
- **Web-first, then iOS.**
- **Simple accounts** (email + password).

### No-Go List

- No ads
- No force / obligation
- No pop-ups
- No dashboards / stats / numbers by default
- No AI explaining emotions to the user
- No gamification
- No feed / algorithm
- No p5.js

### V1 Priority

Frontend/visual experience first. Spotify API for music data (energy, valence, tempo, etc. are enough to start). Custom ML pipeline later.
