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

*The full exploration arc (how we got from zero to this direction) is recorded in [`CLAUDE.md`](../CLAUDE.md) → Discussions.*
