# Otsarot (אוצרות) — AGENTS.md

This repository is the home of **Otsarot**, a tablet-first educational web app for a 3rd-grade Hebrew-speaking child. It is a collection of short, engaging **mini-games (drills)** across multiple subjects (starting with English and Math; Science later).

The app is deployed to **GitHub Pages** and must run as a static site with **HTML + Vanilla JS** (popular libraries are allowed, but **no build pipeline**).

You are an expert product manager and software engineer.

## Product Principles (Kid-first UX)

- **Deliberate practice, short sessions:** optimize for 1–3 minute play loops with fast feedback and “one more round” momentum.
- **No punishment for errors:** never shame; use encouraging language. Errors are learning signals.
- **Always allow retries:** give immediate hints after mistakes; avoid hard fails.
- **Make progress visible:** show small wins (stars, badges, streaks, mastery progress) without pressure.
- **Anti-random-tapping:** detect low-effort input patterns and gently guide back to learning:
  - Slow down the UI after repeated rapid wrong taps.
  - Add “confirm” steps only when necessary (avoid friction by default).
  - Use *time-to-answer*, *tap cadence*, and *answer distribution* heuristics to flag guessing.
  - When guessing is detected, switch to easier items, add stronger hints, or ask to “try carefully”.
- **Age-appropriate tone:** playful and warm; use Hebrew UI text and **emojis where appropriate**.
- **Accessibility & ergonomics:** large touch targets, high contrast, minimal reading load, audio-first where possible.

## Language & Directionality (Hebrew + English)

- **All user-facing UI strings are in Hebrew** (menus, instructions, feedback, reports).
- The UI is primarily **RTL**. English letters and some numbers are **LTR**. Handle mixed-direction content carefully:
  - Prefer wrapping English glyphs in `dir="ltr"` spans inside RTL containers.
  - For arrows/icons, test visually in RTL. Prefer icons that mirror automatically, or provide RTL variants.
  - Keep numeric/percentage formatting consistent (e.g., `85%`) and test how it renders in RTL text.

## Visual Design (Style Guide)

Otsarot should feel soft, modern, and calm: **pastels, gentle gradients, rounded corners**, and subtle motion.

- Use a small set of **CSS variables** (tokens) for colors, spacing, radii, shadows.
- Prefer:
  - Background gradients (very subtle)
  - “Card” UI with rounded corners
  - Large friendly type (system font is fine)
  - Micro-animations (button press, success sparkle) that don’t overwhelm

Suggested palette (adjust as needed):
- Cream background, pastel pink/blue/lavender accents, mint success, warm orange highlight.

## Architecture Goals

Design for **modularity and easy extension**: adding a mini-game should be a predictable process with minimal copy/paste.

The app must provide reusable “generic capabilities”:

- **Profiles** (local-only for now): multiple children in the future.
- **Spaced repetition** at the *item level* (not just per mini-game).
- **Per mini-game mastery score** computed by the mini-game’s own logic.
- **Practice tracking**: last practiced, accuracy, streaks, response time, and scheduling.
- **Reports**:
  - A general report screen accessible from the main menu.
  - Includes: mastery, last practiced, due-now, streak, accuracy, avg response time (and any other key metrics).

## Spaced Repetition Model (Core Requirement)

- Scheduling is **per item**.
- An “item” is **mini-game-specific** and can encode mode/variant. Example for English letters:
  - `(letter: "A", mode: "sound→choose", case: "upper")`
  - `(letter: "a", mode: "opposite-case", case: "lower")`
- The spaced repetition scheduler should be generic, but **items and grading are mini-game-owned**.

## Content Organization (Subjects & Drills)

- The main menu shows subjects (English, Math, …).
- Within each subject, show a growing list of drills/mini-games sorted by **descending creation time** (newest first).
- Each mini-game provides its own configuration UI (e.g., which letters to include/skip).

## Mini-game Contract (Expected Shape)

When implementing a new mini-game, keep the following conceptual boundaries:

- **Engine/shared layer**:
  - Profile management
  - Storage
  - Scheduling primitives
  - Session state (rounds, timers, pause/resume)
  - Common UI components (cards, buttons, progress, toasts)
  - Reporting aggregation
- **Mini-game layer**:
  - Defines its item universe and configuration
  - Implements question generation & evaluation
  - Computes its mastery score
  - Declares which metrics it reports

## New Mini-game Workflow (Checklist + Questions to Ask)

Before coding a new mini-game, the agent should ask the product owner (you) the following (and capture decisions in docs/code):

1) **Learning goal:** what exact skill should improve?
2) **Session design:** target session length (rounds/time), win condition, and stopping behavior.
3) **Item definition:** what uniquely identifies an item for spaced repetition (including modes/variants)?
4) **Difficulty controls:** what levels exist, what changes per level, and default level.
5) **Configuration UI:** what can be enabled/disabled (e.g., include/skip list), and how it’s stored per profile.
6) **Feedback design:** what happens on correct vs incorrect answers (hint steps, retries, partial credit).
7) **Anti-guessing rules:** what heuristics apply and what is the gentle intervention?
8) **Audio/visual assets:** any required sounds, TTS vs recorded, and fallback behavior offline.
9) **Metrics:** what to track (accuracy, response time, streaks, mastery), and what shows in Reports.
10) **Edge cases:** handling “I don’t know”, timeouts, quitting mid-round, and accessibility constraints.

Only after these are answered should implementation start.

## Repo Workflow (How to Work Here)

When implementing a new mini-game or major feature, follow this loop:

1) **Review requirements**: restate goals, constraints (GitHub Pages, no build), and success criteria.
2) **Ask clarifying questions**: iterate until the spec is concrete enough to implement without guessing.
3) **Review and suggest enhancements**: propose product/UX improvements typical of top kids’ learning apps and confirm scope.
4) **Implement + debug**: build the feature end-to-end and validate it by running locally and testing in the in-app browser.

### Deep linking for fast iteration

Support deep navigation via **query params** so it’s easy to open a specific screen/mini-game quickly during development.

Expected examples (keys can evolve, but must exist):
- `?screen=home`
- `?screen=reports`
- `?subject=english&game=letters`

## Engineering Best Practices

- Keep code **small, testable, and separable** (pure functions for scheduling/scoring, UI as thin wrappers).
- Avoid global mutable state; centralize state in a small, explicit store.
- Prefer feature folders for mini-games; avoid tight coupling between mini-games.
- Treat local storage as a versioned data store (include schema version + migration strategy).
- Ensure everything works with GitHub Pages (relative paths, no server assumptions).

## Asset Placement

- All static assets must live under `public/`, organized per feature/game so GitHub Pages can serve them directly.
- Convention:
  - Global/shared assets: `public/audio/`, `public/img/`, etc.
  - Per game assets: `public/<subject>/<game>/...`
  - Example (English letters): `public/english/letters/audio/`
