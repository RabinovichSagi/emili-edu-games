import { el, toast, clear } from "../../../ui/dom.js";
import { nowMs } from "../../../core/time.js";
import { isDue } from "../../../core/sr.js";
import { playOneShot, preloadAudio } from "../../../core/audio.js";
import { showBalloonCelebration } from "../../../ui/celebrations/balloons.js";
import { WORDS_GRADE3 } from "../wordBank.js";

const GAME_ID = "case_typing";
const CREATED_AT = 20260501;

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

function alphabetUpper() {
  const out = [];
  for (let i = 0; i < 26; i++) out.push(String.fromCharCode(65 + i));
  return out;
}

function swapCaseWord(word) {
  const w = String(word || "");
  let out = "";
  for (const ch of w) {
    if (ch >= "a" && ch <= "z") out += ch.toUpperCase();
    else if (ch >= "A" && ch <= "Z") out += ch.toLowerCase();
    else out += ch;
  }
  return out;
}

function itemKey({ mode, word }) {
  return `${mode}|${word}`;
}

function defaultConfig() {
  return {
    createdAt: CREATED_AT,
    roundsPerSession: 10,
    enabledDirections: ["lower_to_upper", "upper_to_lower"],
  };
}

function normalizeConfig(cfg) {
  const current = { ...cfg };
  const enabled = new Set(Array.isArray(current.enabledDirections) ? current.enabledDirections : []);
  if (!enabled.size) {
    enabled.add("lower_to_upper");
    enabled.add("upper_to_lower");
  } else {
    enabled.add("lower_to_upper");
    enabled.add("upper_to_lower");
  }
  current.enabledDirections = [...enabled];
  if (!Number.isFinite(current.roundsPerSession) || current.roundsPerSession <= 0) current.roundsPerSession = 10;
  return current;
}

function computeMastery(profile) {
  const sr = profile.sr?.[GAME_ID] || {};
  const items = Object.values(sr);
  if (!items.length) return 0;
  let total = 0;
  let wsum = 0;
  for (const it of items) {
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

function buildKeyboardLetters({ targetCase }) {
  const upper = alphabetUpper();
  const letters = targetCase === "upper" ? upper : upper.map((x) => x.toLowerCase());
  // Comfortable grid: 7-7-6-6 (sums to 26), big touch targets.
  return [letters.slice(0, 7), letters.slice(7, 14), letters.slice(14, 20), letters.slice(20, 26)];
}

export const EnglishCaseTypingGame = {
  id: GAME_ID,
  titleHe: "כתיבת מילים (גדולות/קטנות)",
  subtitleHe: "רואים מילה — ומקלידים אותה באותיות גדולות/קטנות ⌨️",
  createdAt: CREATED_AT,

  render({ mount, store }) {
    const state = {
      phase: "menu", // menu | play | done | report | settings
      cfg: normalizeConfig(store.getGameConfig(GAME_ID, defaultConfig())),
      round: 0,
      score: 0,
      startAt: 0,
      promptAt: 0,
      current: null,
      typed: "",
      celebrated: false,
    };
    store.setGameConfig(GAME_ID, { enabledDirections: state.cfg.enabledDirections });

    preloadAudio(["./public/audio/answer-correct.mp3"]);

    function rerender() {
      clear(mount);
      if (state.phase === "menu") mount.append(renderMenu());
      else if (state.phase === "play") mount.append(renderPlay());
      else if (state.phase === "report") mount.append(renderReport());
      else if (state.phase === "settings") mount.append(renderSettings());
      else mount.append(renderDone());
    }

    function setCfgDraft(patch) {
      state.cfg = { ...state.cfg, ...patch };
      rerender();
    }

    function saveCfg(patch) {
      state.cfg = { ...state.cfg, ...patch };
      store.setGameConfig(GAME_ID, patch);
      rerender();
    }

    function buildItemPool() {
      const dirs = state.cfg.enabledDirections;
      const pool = [];
      for (const wordLower of WORDS_GRADE3) {
        if (dirs.includes("lower_to_upper")) pool.push({ mode: "lower_to_upper", wordLower });
        if (dirs.includes("upper_to_lower")) pool.push({ mode: "upper_to_lower", wordLower });
      }
      return pool;
    }

    function pickNextItem() {
      const pool = buildItemPool();
      if (!pool.length) return null;

      const due = [];
      for (const it of pool) {
        const key = itemKey({ mode: it.mode, word: it.wordLower });
        const sr = store.getSrItem(GAME_ID, key);
        if (!sr || isDue(sr)) due.push(it);
      }

      const candidates = due.length ? due : pool;
      const sorted = candidates
        .map((it) => {
          const key = itemKey({ mode: it.mode, word: it.wordLower });
          const sr = store.getSrItem(GAME_ID, key);
          return { it, lastAt: sr?.lastAt || 0, attempts: (sr?.correct || 0) + (sr?.wrong || 0) };
        })
        .sort((a, b) => a.lastAt - b.lastAt || a.attempts - b.attempts);

      const slice = sorted.slice(0, Math.max(6, Math.ceil(sorted.length / 3)));
      const chosen = pickRandom(slice).it;

      const promptWord = chosen.mode === "lower_to_upper" ? chosen.wordLower.toLowerCase() : chosen.wordLower.toUpperCase();
      const targetWord = swapCaseWord(promptWord);
      const targetCase = chosen.mode === "lower_to_upper" ? "upper" : "lower";
      return { ...chosen, promptWord, targetWord, targetCase };
    }

    function grade(grade05, rtMs) {
      const key = itemKey({ mode: state.current.mode, word: state.current.wordLower });
      store.gradeItem(GAME_ID, key, grade05, rtMs);
      const profile = store.getProfile();
      store.setGameMastery(GAME_ID, computeMastery(profile));
    }

    function startSession() {
      state.phase = "play";
      state.round = 0;
      state.score = 0;
      state.startAt = nowMs();
      nextRound();
    }

    function nextRound() {
      state.round += 1;
      state.typed = "";
      state.current = pickNextItem();
      if (!state.current) {
        toast("אין מילים לתרגול כרגע 🙂");
        state.phase = "menu";
        rerender();
        return;
      }
      state.promptAt = nowMs();
      store.ensureSrItem(GAME_ID, itemKey({ mode: state.current.mode, word: state.current.wordLower }));
      rerender();
    }

    function finishSession() {
      const profile = store.getProfile();
      store.setGameMastery(GAME_ID, computeMastery(profile));
      state.phase = "done";
      state.celebrated = false;
      rerender();
    }

    function onPressLetter(ch) {
      if (state.phase !== "play") return;
      if (!state.current) return;
      if (state.typed.length >= state.current.targetWord.length) return;
      state.typed += ch;
      rerender();
    }

    function onBackspace() {
      if (state.phase !== "play") return;
      state.typed = state.typed.slice(0, -1);
      rerender();
    }

    function onSubmit() {
      if (!state.current) return;
      const rt = nowMs() - state.promptAt;
      const ok = state.typed === state.current.targetWord;
      const grade05 = ok ? (rt < 4500 ? 5 : 4) : 1;
      grade(grade05, rt);
      if (ok) {
        state.score += 1;
        playOneShot("./public/audio/answer-correct.mp3", { volume: 0.8 });
        toast("כל הכבוד!! 🎉");
        window.setTimeout(() => {
          if (state.round >= state.cfg.roundsPerSession) finishSession();
          else nextRound();
        }, 220);
      } else {
        toast("כמעט… נסי שוב 🙂");
        rerender();
      }
    }

    function renderMenu() {
      return el("div", { class: "list" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [
            el("div", { class: "title", text: "כתיבת מילים (גדולות/קטנות) ⌨️" }),
            el("div", { class: "sub", text: "רואים מילה — ומקלידים אותה באותיות גדולות/קטנות" }),
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
      const enabled = new Set(state.cfg.enabledDirections);
      const btn = (id, label) =>
        el(
          "button",
          {
            class: "btn secondary",
            onClick: () => {
              if (enabled.has(id)) enabled.delete(id);
              else enabled.add(id);
              const arr = [...enabled];
              if (!arr.length) return toast("צריך לפחות מצב אחד 🙂");
              setCfgDraft({ enabledDirections: arr });
            },
          },
          [state.cfg.enabledDirections.includes(id) ? `✅ ${label}` : `⬜ ${label}`]
        );

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
            labelSelect("מספר מילים", String(state.cfg.roundsPerSession), [["6", "6"], ["10", "10"], ["14", "14"]], (v) =>
              setCfgDraft({ roundsPerSession: Number(v) })
            ),
          ]),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "itemRow" }, [el("div", {}, [el("div", { class: "title", text: "כיוון" }), el("div", { class: "sub", text: "אפשר להדליק/לכבות" })])]),
          el("div", { class: "row", style: "margin-top:10px" }, [btn("lower_to_upper", "אותיות קטנות → גדולות"), btn("upper_to_lower", "אותיות גדולות → קטנות")]),
        ]),
      ]);
    }

    function renderPlay() {
      const it = state.current;
      const remaining = state.cfg.roundsPerSession - state.round + 1;
      const header = el("div", { class: "itemRow" }, [
        el("div", {}, [
          el("div", { class: "title", text: `מילה ${state.round}/${state.cfg.roundsPerSession}` }),
          el("div", { class: "sub", text: remaining > 1 ? `נשארו עוד ${remaining - 1} 🙂` : "מילה אחרונה! ✨" }),
        ]),
        el("div", { class: "pill" }, [`ניקוד: ${state.score} ⭐`]),
      ]);

      const instruction = it?.targetCase === "upper" ? "כתבי באותיות גדולות" : "כתבי באותיות קטנות";
      const keyboardRows = it ? buildKeyboardLetters({ targetCase: it.targetCase }) : [];
      const typedSlots = it
        ? el(
            "div",
            { class: "typingSlots", dir: "ltr" },
            [...it.targetWord].map((_, i) =>
              el("div", { class: `typingSlot ${i < state.typed.length ? "filled" : ""}`, dir: "ltr" }, [state.typed[i] || ""])
            )
          )
        : null;

      const body = el("div", { class: "card" }, [
        el("div", { class: "bigPrompt" }, [
          el("div", { class: "ltr", dir: "ltr", style: "font-size:40px; letter-spacing:1px;" }, [it?.promptWord || ""]),
          el("small", { text: instruction }),
        ]),
        typedSlots,
        el(
          "div",
          { class: "kb" },
          keyboardRows.map((row) =>
            el(
              "div",
              { class: "kbRow" },
              row.map((ch) =>
                el(
                  "button",
                  { class: "kbKey ltr", dir: "ltr", onClick: () => onPressLetter(ch) },
                  [ch]
                )
              )
            )
          )
        ),
        el("div", { class: "row", style: "justify-content:center; margin-top:10px" }, [
          el("button", { class: "btn secondary", onClick: onBackspace }, ["⌫"]),
          el("button", { class: "btn", onClick: onSubmit }, ["שלח ✅"]),
        ]),
      ]);

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

    function renderDone() {
      const profile = store.getProfile();
      const mastery = profile.gameStats?.[GAME_ID]?.mastery ?? 0;

      if (!state.celebrated) {
        state.celebrated = true;
        showBalloonCelebration({ count: 26, maxSeconds: 9 });
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
      ]);
    }

    function renderReport() {
      const profile = store.getProfile();
      const mastery = profile.gameStats?.[GAME_ID]?.mastery ?? 0;
      const sr = profile.sr?.[GAME_ID] || {};
      const totalItems = Object.keys(sr).length;
      let dueNow = 0;
      for (const v of Object.values(sr)) if (isDue(v)) dueNow += 1;

      return el("div", { class: "list" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [
            el("div", { class: "title", text: "דוח כתיבת מילים 📊" }),
            el("div", { class: "sub", text: "מאסטרי כללי + כמה מילים מחכות לתרגול" }),
          ]),
          el("button", { class: "btn secondary", onClick: () => ((state.phase = "menu"), rerender()) }, ["חזרה"]),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "row", style: "margin-top:6px" }, [
            kpi("מאסטרי", `${mastery}%`),
            kpi("חזרה עכשיו", totalItems ? `${dueNow}/${totalItems}` : "—"),
          ]),
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

function kpi(k, v) {
  return el("div", { class: "pill" }, [el("div", { class: "kpi" }, [el("div", { class: "k", text: k }), el("div", { class: "v", text: v })])]);
}
