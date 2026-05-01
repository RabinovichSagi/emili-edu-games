import { el, toast, clear } from "../../../ui/dom.js";
import { nowMs } from "../../../core/time.js";
import { isDue } from "../../../core/sr.js";
import { playCached, playOneShot, preloadAudio } from "../../../core/audio.js";
import { showBalloonCelebration } from "../../../ui/celebrations/balloons.js";
import { WORDS_GRADE3 } from "../wordBank.js";

const GAME_ID = "letters";
const CREATED_AT = 20260428;

const MODES = [
  { id: "voice_to_lower", titleHe: "שומעים → אות קטנה" },
  { id: "voice_to_upper", titleHe: "שומעים → אות גדולה" },
  { id: "lower_to_upper", titleHe: "אות קטנה → אות גדולה" },
  { id: "upper_to_lower", titleHe: "אות גדולה → אות קטנה" },
  { id: "lower_to_voice", titleHe: "אות קטנה → צליל" },
  { id: "upper_to_voice", titleHe: "אות גדולה → צליל" },
  { id: "word_highlight_case", titleHe: "מילה עם אות מודגשת → התאמת אות" },
];

function alphabet() {
  const out = [];
  for (let i = 0; i < 26; i++) out.push(String.fromCharCode(65 + i));
  return out;
}

function defaultConfig() {
  return {
    createdAt: CREATED_AT,
    difficulty: "normal", // easy | normal | hard
    enabledModes: MODES.map((m) => m.id),
    enabledLetters: alphabet(),
    roundsPerSession: 10,
    audioEnabled: true,
  };
}

function normalizeConfig(cfg) {
  const allModes = MODES.map((m) => m.id);
  const current = { ...cfg };
  const enabled = new Set(Array.isArray(current.enabledModes) ? current.enabledModes : []);
  if (enabled.size === 0) allModes.forEach((m) => enabled.add(m));
  else allModes.forEach((m) => enabled.add(m)); // ensure newly-added modes default to on
  current.enabledModes = [...enabled];

  if (!Array.isArray(current.enabledLetters)) current.enabledLetters = alphabet();
  return current;
}

function itemKey({ mode, letter, variant }) {
  return `${mode}|${letter}|${variant || ""}`;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function oppositeCase(letter) {
  if (letter.toUpperCase() === letter) return letter.toLowerCase();
  return letter.toUpperCase();
}

function isAlphaLetter(ch) {
  const c = String(ch || "").slice(0, 1);
  return c >= "A" && c <= "Z" ? true : c >= "a" && c <= "z";
}

function pickWordForLetter(letterUpper) {
  const L = String(letterUpper || "").toUpperCase().slice(0, 1);
  const candidates = WORDS_GRADE3.filter((w) => String(w).toUpperCase().includes(L));
  if (candidates.length) return pickRandom(candidates);
  // Fallback: should be rare; still keep the game playable.
  return pickRandom(WORDS_GRADE3);
}

function findAllLetterIndices(word, letterUpper) {
  const w = String(word || "");
  const L = String(letterUpper || "").toUpperCase().slice(0, 1);
  const idxs = [];
  for (let i = 0; i < w.length; i++) {
    if (String(w[i]).toUpperCase() === L) idxs.push(i);
  }
  return idxs;
}

function speakEn(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    u.pitch = 1.05;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

function letterName(letter) {
  return letter.toUpperCase();
}

async function playLetterAudio(letter) {
  // Prefer pre-generated local assets under /public; fallback to speechSynthesis.
  const ch = String(letter).toLowerCase().slice(0, 1);
  const src = `./public/english/letters/audio/${ch}.wav`;
  const ok = await playCached(src, { volume: 1 });
  if (ok) return true;
  return speakEn(letterName(letter));
}

function computeMastery(profile, cfg) {
  // Total mastery is the average of per-letter mastery across all English letters (A–Z),
  // with unseen letters counted as 0.
  const letters = alphabet();
  if (!letters.length) return 0;
  let sum = 0;
  for (const L of letters) sum += computeLetterMastery(profile, L);
  return Math.round(sum / letters.length);
}

function computeLetterMastery(profile, letterUpper) {
  const sr = profile.sr?.[GAME_ID] || {};
  const needleUpper = letterUpper.toUpperCase();
  let total = 0;
  let wsum = 0;
  for (const [k, it] of Object.entries(sr)) {
    const parts = k.split("|");
    if (parts.length < 2) continue;
    const itemLetter = parts[1];
    if (String(itemLetter).toUpperCase() !== needleUpper) continue;
    const attempts = (it.correct || 0) + (it.wrong || 0);
    if (!attempts) continue;
    const acc = (it.correct || 0) / attempts;
    const w = Math.min(6, 1 + (it.reps || 0));
    total += acc * w;
    wsum += w;
  }
  if (!wsum) return 0;
  return Math.round((total / wsum) * 100);
}

export const EnglishLettersGame = {
  id: GAME_ID,
  titleHe: "אותיות באנגלית",
  subtitleHe: "זיהוי אותיות, התאמת גדולות/קטנות, וצלילים 🔊",
  createdAt: CREATED_AT,

  render({ mount, store }) {
    const state = {
      phase: "menu", // menu | play | done | report | settings
      cfg: normalizeConfig(store.getGameConfig(GAME_ID, defaultConfig())),
      round: 0,
      score: 0,
      startAt: 0,
      promptAt: 0,
      lastTapAt: 0,
      guessyTaps: 0,
      narrowingRounds: 0,
      current: null,
      feedback: null,
      celebrated: false,
    };
    // Persist normalized config so older saved configs get upgraded.
    store.setGameConfig(GAME_ID, { enabledModes: state.cfg.enabledModes });

    // Preload/caches assets for snappy play.
    preloadAudio([
      "./public/audio/answer-correct.mp3",
      ...alphabet().map((L) => `./public/english/letters/audio/${L.toLowerCase()}.wav`),
    ]);

    function rerender() {
      clear(mount);
      if (state.phase === "menu") mount.append(renderMenu());
      else if (state.phase === "play") mount.append(renderPlay());
      else if (state.phase === "report") mount.append(renderReport());
      else if (state.phase === "settings") mount.append(renderSettings());
      else mount.append(renderDone());
    }

    function saveCfg(patch) {
      state.cfg = { ...state.cfg, ...patch };
      store.setGameConfig(GAME_ID, patch);
      rerender();
    }

    function setCfgDraft(patch) {
      state.cfg = { ...state.cfg, ...patch };
      rerender();
    }

    function buildItemPool() {
      const letters = state.cfg.enabledLetters;
      const modes = state.cfg.enabledModes;
      const pool = [];
      for (const L of letters) {
        // Treat each (letter, mode) as separate SR items.
        if (modes.includes("voice_to_lower")) pool.push({ mode: "voice_to_lower", letter: L, prompt: null, answer: L.toLowerCase(), variant: "v2l" });
        if (modes.includes("voice_to_upper")) pool.push({ mode: "voice_to_upper", letter: L, prompt: null, answer: L, variant: "v2u" });
        if (modes.includes("lower_to_upper")) pool.push({ mode: "lower_to_upper", letter: L, prompt: L.toLowerCase(), answer: L, variant: "l2u" });
        if (modes.includes("upper_to_lower")) pool.push({ mode: "upper_to_lower", letter: L, prompt: L, answer: L.toLowerCase(), variant: "u2l" });
        if (modes.includes("lower_to_voice")) pool.push({ mode: "lower_to_voice", letter: L, prompt: L.toLowerCase(), answer: L, variant: "l2v" });
        if (modes.includes("upper_to_voice")) pool.push({ mode: "upper_to_voice", letter: L, prompt: L, answer: L, variant: "u2v" });
        if (modes.includes("word_highlight_case"))
          pool.push({
            mode: "word_highlight_case",
            letter: L,
            prompt: null,
            answer: null,
            variant: "wh",
          });
      }
      return pool;
    }

    function hydrateWordHighlightItem(baseItem) {
      const letterUpper = String(baseItem.letter).toUpperCase();
      const word = pickWordForLetter(letterUpper);
      const indices = findAllLetterIndices(word, letterUpper);
      const highlightIndex = indices.length ? pickRandom(indices) : 0;
      // Teacher asked for both: words shown ALL upper and ALL lower.
      const showLower = Math.random() < 0.5;
      const displayWord = showLower ? word.toLowerCase() : word.toUpperCase();
      const highlightedChar = displayWord[highlightIndex] || (showLower ? letterUpper.toLowerCase() : letterUpper);
      const want = oppositeCase(highlightedChar);
      const wantCase = want === want.toUpperCase() ? "upper" : "lower";
      return {
        ...baseItem,
        prompt: { type: "word_highlight", word: displayWord, highlightIndex, showLower },
        answer: want,
        wantCase,
      };
    }

    function pickNextItem() {
      const profile = store.getProfile();
      const pool = buildItemPool();
      if (!pool.length) return null;
      // Prefer due items; otherwise pick least-recently seen.
      const due = [];
      for (const it of pool) {
        const key = itemKey(it);
        const sr = store.getSrItem(GAME_ID, key);
        if (!sr || isDue(sr)) due.push(it);
      }
      const candidates = due.length ? due : pool;
      const sorted = candidates
        .map((it) => {
          const key = itemKey(it);
          const sr = store.getSrItem(GAME_ID, key);
          return { it, lastAt: sr?.lastAt || 0, attempts: (sr?.correct || 0) + (sr?.wrong || 0) };
        })
        .sort((a, b) => a.lastAt - b.lastAt || a.attempts - b.attempts);
      // Take from the oldest ~1/3 to keep variety.
      const slice = sorted.slice(0, Math.max(4, Math.ceil(sorted.length / 3)));
      const chosen = pickRandom(slice).it;
      if (chosen.mode === "word_highlight_case") return hydrateWordHighlightItem(chosen);
      return chosen;
    }

    function startSession() {
      if (!state.cfg.enabledLetters.length) {
        toast("צריך לבחור לפחות אות אחת לתרגול 🙂");
        return;
      }
      state.phase = "play";
      state.round = 0;
      state.score = 0;
      state.startAt = nowMs();
      state.guessyTaps = 0;
      state.narrowingRounds = 0;
      nextRound();
    }

    function nextRound() {
      state.round += 1;
      state.feedback = null;
      state.current = pickNextItem();
      if (!state.current) {
        toast("אין פריטים לתרגול כרגע 🙂");
        state.phase = "menu";
        rerender();
        return;
      }
      state.promptAt = nowMs();
      // Pre-create SR item so it appears in reports.
      store.ensureSrItem(GAME_ID, itemKey(state.current));
      // Every question starts by sounding the letter (if audio is enabled), regardless of mode.
      if (state.cfg.audioEnabled) playLetterAudio(state.current.letter);
      rerender();
    }

    function finishSession() {
      const profile = store.getProfile();
      const mastery = computeMastery(profile, state.cfg);
      store.setGameMastery(GAME_ID, mastery);
      state.phase = "done";
      state.celebrated = false;
      rerender();
    }

    function grade(grade05, rtMs) {
      const key = itemKey(state.current);
      store.gradeItem(GAME_ID, key, grade05, rtMs);
      const profile = store.getProfile();
      store.setGameMastery(GAME_ID, computeMastery(profile, state.cfg));
    }

    function onTapHeuristic() {
      const t = nowMs();
      const dt = t - state.lastTapAt;
      state.lastTapAt = t;
      if (dt > 0 && dt < 280) state.guessyTaps += 1;
      else state.guessyTaps = Math.max(0, state.guessyTaps - 1);
      if (state.guessyTaps >= 3) {
        state.narrowingRounds = 3;
        state.guessyTaps = 0;
        toast("בואי ננסה לאט ובכוונה 🙂");
      }
    }

    function renderMenu() {
      return el("div", { class: "list" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [
            el("div", { class: "title", text: "אותיות באנגלית 🔤" }),
            el("div", { class: "sub", text: "תרגול קצר, חכם וכיפי — עם חזרות בזמן הנכון ✨" }),
          ]),
          el("div", { class: "row" }, [
            el("button", { class: "btn secondary", onClick: () => ((state.phase = "report"), rerender()) }, ["דוח 📊"]),
            el("button", { class: "btn secondary", onClick: () => ((state.phase = "settings"), rerender()) }, ["⚙️"]),
            el("button", { class: "btn", onClick: startSession }, ["התחל/י"]),
          ]),
        ]),
      ]);
    }

    function renderSettings() {
      return el("div", { class: "list" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [el("div", { class: "title", text: "הגדרות ⚙️" }), el("div", { class: "sub", text: "שמרו כדי לחזור למשחק" })]),
          el("div", { class: "row" }, [
            el("button", { class: "btn secondary", onClick: () => ((state.phase = "menu"), rerender()) }, ["ביטול"]),
            el("button", { class: "btn", onClick: () => (store.setGameConfig(GAME_ID, state.cfg), (state.phase = "menu"), rerender()) }, ["שמירה"]),
          ]),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "row" }, [
            labelSelect(
              "רמת קושי",
              state.cfg.difficulty,
              [
                ["easy", "קל 😌"],
                ["normal", "רגיל 🙂"],
                ["hard", "קשה 💪"],
              ],
              (v) => setCfgDraft({ difficulty: v })
            ),
            labelSelect("מספר סבבים", String(state.cfg.roundsPerSession), [["6", "6"], ["10", "10"], ["14", "14"]], (v) =>
              setCfgDraft({ roundsPerSession: Number(v) })
            ),
            labelToggle("צליל", state.cfg.audioEnabled, (v) => setCfgDraft({ audioEnabled: v })),
          ]),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "itemRow" }, [
            el("div", {}, [el("div", { class: "title", text: "מצבי תרגול" }), el("div", { class: "sub", text: "אפשר להדליק/לכבות" })]),
          ]),
          el(
            "div",
            { class: "row", style: "margin-top:10px" },
            MODES.map((m) =>
              el(
                "button",
                {
                  class: `btn secondary`,
                  onClick: () => {
                    const enabled = new Set(state.cfg.enabledModes);
                    if (enabled.has(m.id)) enabled.delete(m.id);
                    else enabled.add(m.id);
                    const arr = [...enabled];
                    if (!arr.length) return toast("צריך לפחות מצב אחד 🙂");
                    setCfgDraft({ enabledModes: arr });
                  },
                },
                [state.cfg.enabledModes.includes(m.id) ? `✅ ${m.titleHe}` : `⬜ ${m.titleHe}`]
              )
            )
          ),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "itemRow" }, [
            el("div", {}, [el("div", { class: "title", text: "אותיות לתרגול" }), el("div", { class: "sub", text: "סמנו אילו אותיות לתרגל" })]),
          ]),
          el("div", { class: "row", style: "margin-top:10px" }, [
            el("button", { class: "btn secondary", onClick: () => setCfgDraft({ enabledLetters: alphabet() }) }, ["בחר/י הכל"]),
            el("button", { class: "btn secondary", onClick: () => setCfgDraft({ enabledLetters: [] }) }, ["נקה/י הכל"]),
          ]),
          el("div", { class: "card", style: "margin-top:12px" }, [
            el("div", { class: "sub", text: "ליד כל אות: מאסטרי" }),
            renderLetterChecklist(store.getProfile(), state.cfg, (patch) => setCfgDraft(patch)),
          ]),
        ]),
      ]);
    }

    function renderPlay() {
      const it = state.current;
      const remaining = state.cfg.roundsPerSession - state.round + 1;
      const header = el("div", { class: "itemRow" }, [
        el("div", {}, [
          el("div", { class: "title", text: `סבב ${state.round}/${state.cfg.roundsPerSession}` }),
          el("div", { class: "sub", text: remaining > 1 ? `נשארו עוד ${remaining - 1} 🙂` : "סבב אחרון! ✨" }),
        ]),
        el("div", { class: "pill" }, [`ניקוד: ${state.score} ⭐`]),
      ]);

      const body = el("div", { class: "card" }, [renderPrompt(it), renderChoices(it)]);

      return el("div", { class: "list" }, [
        header,
        body,
        el("div", { class: "row" }, [
          el("button", { class: "btn secondary", onClick: () => ((state.phase = "report"), rerender()) }, ["דוח 📊"]),
          el("button", { class: "btn secondary", onClick: () => (state.phase = "menu") && rerender() }, ["להגדרות"]),
          el("button", { class: "btn danger", onClick: finishSession }, ["לסיים"]),
        ]),
      ]);
    }

    function speakCurrent() {
      const it = state.current;
      if (!it) return;
      if (!state.cfg.audioEnabled) return;
      playLetterAudio(it.letter);
    }

    function renderPrompt(it) {
      if (it.mode === "word_highlight_case") {
        const word = it.prompt?.word || "";
        const highlightIndex = Number.isFinite(it.prompt?.highlightIndex) ? it.prompt.highlightIndex : 0;
        const chars = [...String(word)];
        const pieces = chars.map((ch, i) => {
          if (i === highlightIndex && isAlphaLetter(ch)) {
            return el("span", { style: "color:#e11d48; font-weight:900;" }, [ch]);
          }
          return el("span", {}, [ch]);
        });
        const instruction = it.wantCase === "lower" ? "בחרי את האות הקטנה שמתאימה לאות האדומה" : "בחרי את האות הגדולה שמתאימה לאות האדומה";
        return el("div", { class: "bigPrompt" }, [
          el("div", { class: "ltr", dir: "ltr", style: "font-size:40px; letter-spacing:1px;" }, pieces),
          el("small", { text: instruction }),
        ]);
      }
      if (it.mode === "voice_to_lower" || it.mode === "voice_to_upper") {
        return el("div", { class: "bigPrompt" }, [
          el("div", { text: "מה שמעת? 👂" }),
          el("small", { text: it.mode === "voice_to_lower" ? "בחרי את האות הקטנה" : "בחרי את האות הגדולה" }),
          el(
            "div",
            { class: "row", style: "justify-content:center; margin-top:12px" },
            [
              el(
                "button",
                {
                  class: "btn",
                  onClick: () => (state.cfg.audioEnabled ? speakCurrent() : toast("צליל כבוי כרגע 🙂")),
                },
                ["🔊 השמעה"]
              ),
            ]
          ),
        ]);
      }
      if (it.mode === "lower_to_voice" || it.mode === "upper_to_voice") {
        return el("div", { class: "bigPrompt" }, [
          el("div", { class: "ltr", text: it.prompt }),
          el("small", { text: "בחרי את הצליל המתאים לאות" }),
        ]);
      }
      return el("div", { class: "bigPrompt" }, [
        el("div", { class: "ltr", text: it.prompt }),
        el("small", { text: it.mode === "lower_to_upper" ? "בחרי את האות הגדולה" : "בחרי את האות הקטנה" }),
      ]);
    }

    function renderChoices(it) {
      if (it.mode === "lower_to_voice" || it.mode === "upper_to_voice") {
        const letters = state.cfg.enabledLetters;
        const correctUpper = it.letter.toUpperCase();
        const baseCount = state.cfg.difficulty === "easy" ? 2 : state.cfg.difficulty === "hard" ? 6 : 4;
        const count = state.narrowingRounds > 0 ? 2 : baseCount;
        if (state.narrowingRounds > 0) state.narrowingRounds -= 1;

        const distractors = shuffle(letters.filter((x) => x.toUpperCase() !== correctUpper)).slice(0, Math.max(0, count - 1));
        const options = shuffle([correctUpper, ...distractors.map((d) => d.toUpperCase())]);

        return el(
          "div",
          { class: "choices" },
          options.map((optUpper) => renderVoiceOption(optUpper, (e) => onChooseVoice(optUpper, e)))
        );
      }

      if (it.mode === "word_highlight_case") {
        // Teacher asked for 4 options (fixed).
        const count = 4;
        const letters = state.cfg.enabledLetters;
        const correct = String(it.answer || "");
        const correctUpper = correct.toUpperCase();
        const otherLetters = shuffle(letters.filter((x) => x.toUpperCase() !== correctUpper)).slice(0, Math.max(0, count - 1));
        const optionLettersUpper = shuffle([correctUpper, ...otherLetters.map((x) => x.toUpperCase())]);
        const options = optionLettersUpper.map((L) => (it.wantCase === "lower" ? L.toLowerCase() : L.toUpperCase()));
        return el(
          "div",
          { class: "choices" },
          options.map((opt) =>
            el(
              "button",
              {
                class: "choiceBtn ltr",
                onClick: (e) => onChoose(opt, e),
                dir: "ltr",
              },
              [opt]
            )
          )
        );
      }

      const letters = state.cfg.enabledLetters;
      const correct = it.answer; // either upper or lower form depending on mode

      const baseCount = state.cfg.difficulty === "easy" ? 2 : state.cfg.difficulty === "hard" ? 6 : 4;
      const count = state.narrowingRounds > 0 ? 2 : baseCount;
      if (state.narrowingRounds > 0) state.narrowingRounds -= 1;

      // Ensure the same letter never appears twice across cases in the options.
      const correctUpper = String(correct).toUpperCase();
      const otherLetters = shuffle(letters.filter((x) => x.toUpperCase() !== correctUpper)).slice(0, Math.max(0, count - 1));
      const optionLettersUpper = shuffle([correctUpper, ...otherLetters.map((x) => x.toUpperCase())]);
      const options = optionLettersUpper.map((L) => {
        // pick appropriate case for this mode
        if (it.mode === "voice_to_lower" || it.mode === "upper_to_lower") return L.toLowerCase();
        if (it.mode === "voice_to_upper" || it.mode === "lower_to_upper") return L.toUpperCase();
        // fallback
        return L;
      });

      return el(
        "div",
        { class: "choices" },
        options.map((opt) =>
          el(
            "button",
            {
              class: "choiceBtn ltr",
              onClick: (e) => onChoose(opt, e),
              dir: "ltr",
            },
            [opt]
          )
        )
      );
    }

    function onChooseVoice(optUpper, e) {
      const rt = nowMs() - state.promptAt;
      onTapHeuristic();
      const correctUpper = state.current.letter.toUpperCase();
      const ok = optUpper.toUpperCase() === correctUpper;
      const grade05 = ok ? (rt < 2600 ? 5 : 4) : 1;
      grade(grade05, rt);
      if (ok) {
        const btn = e?.currentTarget;
        if (btn && btn.classList) btn.classList.add("good");
        state.score += 1;
        playOneShot("./public/audio/answer-correct.mp3", { volume: 0.8 });
        toast("כל הכבוד!! 🎉");
        window.setTimeout(() => {
          if (state.round >= state.cfg.roundsPerSession) finishSession();
          else nextRound();
        }, 500);
      } else {
        toast("כמעט… נסי שוב 🙂");
        const btn = e?.currentTarget;
        if (btn && btn.classList) btn.classList.add("bad");
        disableChoicesTemporarily();
        state.narrowingRounds = Math.max(state.narrowingRounds, 1);
        window.setTimeout(() => rerender(), 460);
      }
    }

    function markPlayed(ok) {
      const rt = nowMs() - state.promptAt;
      onTapHeuristic();
      // Treat as successful recall if they pressed after listening.
      grade(ok ? 4 : 2, rt);
      state.score += ok ? 1 : 0;
      if (state.round >= state.cfg.roundsPerSession) finishSession();
      else nextRound();
    }

    function onChoose(opt, e) {
      const rt = nowMs() - state.promptAt;
      onTapHeuristic();
      const ok = opt === state.current.answer;
      const grade05 = ok ? (rt < 2200 ? 5 : 4) : 1;
      grade(grade05, rt);
      if (ok) {
        const btn = e?.currentTarget;
        if (btn && btn.classList) btn.classList.add("good");
        state.score += 1;
        playOneShot("./public/audio/answer-correct.mp3", { volume: 0.8 });
        toast("כל הכבוד!! 🎉");
        window.setTimeout(() => {
          if (state.round >= state.cfg.roundsPerSession) finishSession();
          else nextRound();
        }, 200);
      } else {
        toast("כמעט… נסי שוב 🙂");
        const btn = e?.currentTarget;
        if (btn && btn.classList) btn.classList.add("bad");
        disableChoicesTemporarily();
        // gentle retry: keep same item, reduce options next time
        state.narrowingRounds = Math.max(state.narrowingRounds, 1);
        if (state.cfg.audioEnabled) speakCurrent();
        // Let the child see the wrong feedback before re-rendering options.
        window.setTimeout(() => rerender(), 460);
      }
    }

    function disableChoicesTemporarily() {
      const buttons = mount.querySelectorAll(".choices button");
      buttons.forEach((b) => (b.disabled = true));
      window.setTimeout(() => buttons.forEach((b) => (b.disabled = false)), 1000);
    }

    function renderDone() {
      const profile = store.getProfile();
      const mastery = profile.gameStats?.[GAME_ID]?.mastery ?? 0;

      if (!state.celebrated) {
        state.celebrated = true;
        // Reusable end-of-session celebration.
        showBalloonCelebration({ count: 30, maxSeconds: 10 });
      }

      return el("div", { class: "list" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [
            el("div", { class: "title", text: "סיימנו! 🥳" }),
            el("div", { class: "sub", text: `ניקוד: ${state.score}/${state.cfg.roundsPerSession} ⭐ • מאסטרי: ${mastery}%` }),
          ]),
        ]),
        el("div", { class: "row" }, [
          el("button", { class: "btn", onClick: () => (state.phase = "play") && startSession() }, ["עוד סיבוב! 🔁"]),
          el("button", { class: "btn secondary", onClick: () => (state.phase = "menu") && rerender() }, ["הגדרות"]),
          el("button", { class: "btn secondary", onClick: () => ((state.phase = "report"), rerender()) }, ["דוח 📊"]),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "itemRow" }, [
            el("div", {}, [
              el("div", { class: "title", text: "טיפ" }),
              el("div", { class: "sub", text: "עדיף 2–3 סבבים קצרים ביום מאשר סשן אחד ארוך 🙂✨" }),
            ]),
          ]),
        ]),
      ]);
    }

    function renderReport() {
      const profile = store.getProfile();
      const total = computeMastery(profile, state.cfg);
      const letters = alphabet();
      return el("div", { class: "list" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [
            el("div", { class: "title", text: "דוח אותיות 📊" }),
            el("div", { class: "sub", text: "מאסטרי לכל אות + סה״כ (כולל אותיות שלא תרגלנו עדיין)" }),
          ]),
          el("button", { class: "btn secondary", onClick: () => ((state.phase = "menu"), rerender()) }, ["חזרה"]),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "itemRow" }, [
            el("div", {}, [el("div", { class: "title", text: "מאסטרי כולל" }), el("div", { class: "sub", text: "ממוצע A–Z (לא מתורגל = 0%)" })]),
            el("div", { class: "pill" }, [el("span", { text: `${total}%` })]),
          ]),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "sub", text: "מאסטרי לפי אות" }),
          renderLetterMasteryGrid(profile, letters),
        ]),
      ]);
    }

    rerender();
  },
};

function labelSelect(label, value, options, onChange) {
  return el("label", { class: "pill" }, [
    el("span", { text: `${label}: ` }),
    el(
      "select",
      {
        style: "min-height:44px; border-radius:999px; border:1px solid rgba(31,36,48,.12); background:rgba(255,255,255,.8); padding:8px 10px; font-weight:800;",
        onChange: (e) => onChange(e.target.value),
      },
      options.map(([v, t]) => el("option", { value: v, text: t, ...(v === value ? { selected: true } : {}) }))
    ),
  ]);
}

function labelToggle(label, checked, onToggle) {
  return el("button", { class: "btn secondary", onClick: () => onToggle(!checked) }, [checked ? `✅ ${label}` : `⬜ ${label}`]);
}

function renderVoiceOption(letterUpper, onSelect) {
  return el(
    "button",
    {
      class: "choiceBtn",
      style: "position:relative; padding:12px;",
      onClick: onSelect,
    },
    [
      el(
        "button",
        {
          class: "btn secondary",
          style:
            "position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); min-width:72px; min-height:72px; padding:18px 20px; border-radius:22px; font-size:22px;",
          onClick: (e) => {
            e.stopPropagation();
            e.preventDefault();
            playLetterAudio(letterUpper);
          },
          title: "השמעה",
        },
        ["🔊"]
      ),
    ]
  );
}

function renderLetterChecklist(profile, cfg, saveCfg) {
  const enabled = new Set(cfg.enabledLetters);
  const letters = alphabet();
  const grid = el("div", { class: "letterGrid" });
  for (const L of letters) {
    const mastery = computeLetterMastery(profile, L);
    const checked = enabled.has(L);
    const cell = el("label", { class: "letterCell", title: `מאסטרי ${mastery}%` }, [
      el("span", { class: "ltr letterGlyph", dir: "ltr", text: L }),
      el("span", { class: "letterMastery", text: `${mastery}%` }),
      el("input", {
        type: "checkbox",
        checked: checked ? true : null,
        onChange: (e) => {
          const next = new Set(cfg.enabledLetters);
          if (e.target.checked) next.add(L);
          else next.delete(L);
          saveCfg({ enabledLetters: [...next] });
        },
      }),
    ]);
    grid.append(cell);
  }
  return grid;
}

function renderLetterMasteryGrid(profile, letters) {
  const grid = el("div", { class: "letterGrid" });
  for (const L of letters) {
    const mastery = computeLetterMastery(profile, L);
    grid.append(
      el("div", { class: "letterCell" }, [
        el("span", { class: "ltr letterGlyph", dir: "ltr", text: L }),
        el("span", { class: "letterMastery", text: `${mastery}%` }),
      ])
    );
  }
  return grid;
}
