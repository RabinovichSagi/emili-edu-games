# English Letters (אותיות באנגלית) — PRD + Technical Notes

This folder implements the first Otsarot mini-game: **English Letters**.

Primary implementation: `src/subjects/english/letters/game.js`

This document is intended to help future agents:
- understand the product intent (PRD),
- preserve the kid-first UX decisions,
- reuse the same architectural patterns for additional mini-games.

---

## 1) Product Requirements (PRD)

### Goal
Help a 3rd-grade Hebrew-speaking child practice **recognizing English letters** via very short, high-feedback rounds.

### Target user & constraints
- Primary user: 3rd grade (for now).
- UI language: **Hebrew-only**.
- Layout: **RTL** overall, with **LTR** islands for English letters.
- Platform: tablet-first web app, deployed via GitHub Pages (static site, no build pipeline).

### Session design
- Default session: `roundsPerSession` (configurable; typical 6/10/14).
- Each round: one prompt and a multiple-choice response.
- Feedback loop:
  - Correct: green flash + success sound + short delay, then next question.
  - Incorrect: red wiggle + **buttons disabled for 1 second** (anti-guessing) + retry on same item with fewer options.

### Modes (question types)
All modes are enabled by default. Each mode participates in spaced repetition as a distinct item dimension.

Modes:
1) `voice_to_lower` — hear the letter name → choose lowercase form.
2) `voice_to_upper` — hear the letter name → choose uppercase form.
3) `lower_to_upper` — see lowercase → choose uppercase.
4) `upper_to_lower` — see uppercase → choose lowercase.
5) `lower_to_voice` — see lowercase → select the correct sound.
6) `upper_to_voice` — see uppercase → select the correct sound.

**Important**: Every question starts by playing the letter name audio (if audio is enabled), regardless of mode.

### Content selection (letters)
- The child/practitioner can choose which letters to practice with **per-letter checkboxes**.
- Next to each letter, show a **per-letter mastery** percent.
- Unseen letters are allowed, but the game blocks starting a session with zero selected letters.

### Answer option rules
- For letter-choice questions: do **not** show the same letter twice in different cases in the options.
  - Example: do not show `A` and `a` simultaneously as two options.
- For sound-choice questions: the option button must **not** display the letter.
  - Each option is a “sound tile”: inner 🔊 plays the sound; tapping the tile (outside the inner button) selects the option.

### Spaced repetition + mastery
- Scheduling is **per item** (not just per game).
- An SR “item” key includes the mode variant, so each mode×letter is a distinct SR track.
- Total mini-game mastery is:
  - the average of per-letter mastery across **A–Z**,
  - and **unseen letters count as 0%** and are included in the average.

### Reports (inside the game)
The mini-game includes an internal report screen accessible from:
- game menu,
- during play,
- and the end screen.

The in-game report shows:
- total mastery (A–Z average, unseen = 0),
- mastery per letter (A–Z grid).

### Tone & safety
- Always encouraging; never punishing.
- Anti-guessing is gentle: slow down rapid guessing without adding heavy friction.

---

## 2) Technical Design

### Entry point / registration
- The game is registered via the game host:
  - `src/screens/gameHost.js` → registry → `EnglishLettersGame.render()`

### Persistent storage (LocalStorage)
Storage is managed by the shared store and persisted under one key:
- `src/core/store.js`
- `src/core/storage.js`

The store holds:
- profile data,
- per-game config,
- per-item SR state (`profile.sr[gameId][itemKey]`),
- per-game summary stats (`profile.gameStats[gameId]`).

### Per-item SR model
Generic SR functions live here:
- `src/core/sr.js`

This mini-game defines its SR “itemKey” and calls:
- `store.ensureSrItem(gameId, itemKey)` when an item is shown,
- `store.gradeItem(gameId, itemKey, grade, rtMs)` after answers.

### Mastery calculation
This mini-game owns mastery logic:
- `computeLetterMastery(profile, letterUpper)` returns per-letter mastery.
- `computeMastery(profile, cfg)` returns total mastery as A–Z average (unseen=0).

### Assets + caching
Asset placement rule (repo-wide):
- Put assets under `public/<subject>/<game>/...` (see `AGENTS.md`).

This mini-game uses:
- Letter audio: `public/english/letters/audio/a.wav` … `z.wav`
- Correct SFX: `public/audio/answer-correct.mp3`

Audio helpers:
- `src/core/audio.js`
  - `preloadAudio()` creates `Audio` objects and caches them.
  - `playCached()` reuses cached audio when possible.
  - `playOneShot()` plays a one-off (used for the correct SFX).

On game load, we preload:
- `answer-correct.mp3`
- all letter audio files A–Z

If letter audio is missing, the game falls back to `speechSynthesis` (best-effort).

### UI implementation notes
- UI is vanilla DOM creation using:
  - `src/ui/dom.js` (`el()`, `toast()`, etc.)
- RTL/LTR:
  - letter glyphs are wrapped with `.ltr` and `dir="ltr"` in relevant places.

### Anti-guessing mechanics
This mini-game uses two layers:
1) **Rapid tap heuristic**: if taps are extremely fast, reduce option count for a few rounds + show a gentle toast.
2) **Hard throttle on wrong answer**: disable all `.choices button` for 1 second and lower opacity.

### Deep links
The overall app supports query-param deep links:
- Home: `?screen=home`
- Reports: `?screen=reports`
- This game: `?subject=english&game=letters`

---

## 3) Patterns to Reuse for Future Mini-games

When building new games, reuse these patterns:

- **Game module exports a `render({ mount, store, router })` function** and owns its own view/state machine.
- **Store-driven persistence**:
  - keep config in `store.getGameConfig()` / `store.setGameConfig()`,
  - keep SR per item via `store.ensureSrItem()` / `store.gradeItem()`.
- **Preload assets at game load** via `preloadAudio()` (and similar helpers for images later).
- **Anti-guessing as gentle throttles**, not punishments.
- **In-game report screen** with game-specific metrics that map back to the global report model later.

---

## 4) Known Limitations / Future Improvements

- The SR algorithm is currently simple; we may refine grading/interval logic as more games are added.
- The per-letter mastery metric is accuracy-weighted; we may incorporate recency and stability.
- Consider adding:
  - “I don’t know” button (graded as fail without shame),
  - a daily “due now” mode,
  - per-profile naming & avatar selection,
  - better offline-first caching (Service Worker) once we stabilize assets and URLs.

