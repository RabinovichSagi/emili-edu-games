import { el, toast, clear } from "../../../ui/dom.js";
import { nowMs } from "../../../core/time.js";
import { isDue } from "../../../core/sr.js";
import { playOneShot, preloadAudio } from "../../../core/audio.js";
import { showBalloonCelebration } from "../../../ui/celebrations/balloons.js";
import { PROBLEM_PATTERNS, PATTERN_BY_ID } from "./patterns.js";
import { ALL_PROBLEM_TEMPLATES, TEMPLATES_BY_PATTERN } from "./templates/index.js";
import { difficultyOptions, generateProblemFromTemplate } from "./numberGeneration.js";

const GAME_ID = "problem_solving";
const SUBJECT_ID = "math";
const CREATED_AT = 20260515.1;
const DIFFICULTY_LABELS = { easy: "קל", normal: "רגיל", challenge: "אתגר" };

function defaultConfig() {
  return {
    createdAt: CREATED_AT,
    roundsPerSession: 6,
    difficulty: "normal",
    enabledPatternIds: PROBLEM_PATTERNS.slice(0, 10).map((p) => p.id),
  };
}

function normalizeConfig(cfg) {
  const n = { ...defaultConfig(), ...cfg };
  n.roundsPerSession = clamp(Number(n.roundsPerSession) || 6, 4, 10);
  if (!difficultyOptions().includes(n.difficulty)) n.difficulty = "normal";
  const validIds = new Set(PROBLEM_PATTERNS.map((p) => p.id));
  n.enabledPatternIds = Array.isArray(n.enabledPatternIds) ? n.enabledPatternIds.filter((id) => validIds.has(id)) : [];
  if (!n.enabledPatternIds.length) n.enabledPatternIds = defaultConfig().enabledPatternIds;
  return n;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function itemKey(problem) {
  return `${problem.patternId}|${problem.templateId}|${problem.patternTitleHe}`;
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
    const speedBonus = it.avgRtMs && it.avgRtMs < 15000 ? 0.05 : 0;
    const w = Math.min(7, 1 + (it.reps || 0));
    total += Math.min(1, acc + speedBonus) * w;
    wsum += w;
  }
  return wsum ? Math.round((total / wsum) * 100) : 0;
}

function answerText(problem) {
  if (problem.patternId === "sufficiency") return problem.answer === 1 ? "כן" : "לא";
  return String(problem.answer);
}

export const MathProblemSolvingGame = {
  id: GAME_ID,
  titleHe: "בעיות מילוליות",
  subtitleHe: "קוראים סיפור קצר, בוחרים פעולה בראש ומקלידים תשובה סופית 🔢",
  createdAt: CREATED_AT,

  render({ mount, store, router }) {
    const state = {
      phase: "menu",
      cfg: normalizeConfig(store.getGameConfig(GAME_ID, defaultConfig(), SUBJECT_ID)),
      round: 0,
      score: 0,
      current: null,
      promptAt: 0,
      answer: "",
      attempts: 0,
      quickErrors: 0,
      lastTapAt: 0,
      showHint: false,
      locked: false,
      celebrated: false,
    };

    store.setGameConfig(GAME_ID, { ...state.cfg }, SUBJECT_ID);
    preloadAudio(["./public/audio/answer-correct.mp3"]);

    function rerender() {
      clear(mount);
      if (state.phase === "settings") mount.append(renderSettings());
      else if (state.phase === "report") mount.append(renderReport());
      else if (state.phase === "play") mount.append(renderPlay());
      else if (state.phase === "done") mount.append(renderDone());
      else mount.append(renderMenu());
    }

    function saveCfg(patch) {
      state.cfg = normalizeConfig({ ...state.cfg, ...patch });
      store.setGameConfig(GAME_ID, patch, SUBJECT_ID);
      rerender();
    }

    function templatesForConfig() {
      return state.cfg.enabledPatternIds.flatMap((id) => TEMPLATES_BY_PATTERN[id] || []);
    }

    function pickNextProblem() {
      const templates = templatesForConfig().length ? templatesForConfig() : ALL_PROBLEM_TEMPLATES;
      const generated = templates.map((template) => generateProblemFromTemplate(template, state.cfg.difficulty));
      const due = generated.filter((p) => {
        const sr = store.getSrItem(GAME_ID, itemKey(p));
        return !sr || isDue(sr);
      });
      const candidates = due.length ? due : generated;
      const sorted = candidates
        .map((p) => ({ problem: p, sr: store.getSrItem(GAME_ID, itemKey(p)) }))
        .sort((a, b) => (a.sr?.lastAt || 0) - (b.sr?.lastAt || 0));
      return pickRandom(sorted.slice(0, Math.max(5, Math.ceil(sorted.length / 3)))).problem;
    }

    function startSession() {
      state.phase = "play";
      state.round = 0;
      state.score = 0;
      nextRound();
    }

    function nextRound() {
      if (state.round >= state.cfg.roundsPerSession) return finishSession();
      state.round += 1;
      state.current = pickNextProblem();
      state.promptAt = nowMs();
      state.answer = "";
      state.attempts = 0;
      state.showHint = false;
      state.locked = false;
      store.ensureSrItem(GAME_ID, itemKey(state.current));
      rerender();
    }

    function appendDigit(digit) {
      if (state.locked) return;
      const t = nowMs();
      if (t - state.lastTapAt < 170) state.quickErrors += 1;
      state.lastTapAt = t;
      if (state.quickErrors >= 6) {
        state.quickErrors = 0;
        state.showHint = true;
        toast("נאט קצת ונחשוב לפני שמקלידים 🙂", 2000);
      }
      if (state.answer.length < 5) state.answer += digit;
      rerender();
    }

    function backspace() {
      if (state.locked) return;
      state.answer = state.answer.slice(0, -1);
      rerender();
    }

    function clearAnswer() {
      if (state.locked) return;
      state.answer = "";
      rerender();
    }

    function checkAnswer() {
      if (!state.current || state.locked) return;
      if (!state.answer) {
        toast("קודם מקלידים תשובה בתיבה 🙂", 1600);
        return;
      }
      state.attempts += 1;
      const numeric = Number(state.answer);
      const ok = Number.isInteger(numeric) && numeric === state.current.answer;
      if (ok) {
        const rtMs = nowMs() - state.promptAt;
        const grade = state.attempts === 1 ? 5 : 4;
        store.gradeItem(GAME_ID, itemKey(state.current), grade, rtMs);
        store.setGameMastery(GAME_ID, computeMastery(store.getProfile()));
        state.score += grade === 5 ? 1 : 0;
        state.locked = true;
        playOneShot("./public/audio/answer-correct.mp3");
        toast("מעולה! פתרון נכון ✅", 1500);
      } else {
        state.showHint = true;
        const message = state.attempts >= 2
          ? `כמעט. התשובה היא ${answerText(state.current)} — ננסה תרגיל נוסף ונמשיך להתחזק 🌱`
          : "עוד לא. קראו שוב: מה ידוע ומה שואלים? 🔎";
        toast(message, 2600);
        if (state.attempts >= 2) {
          const rtMs = nowMs() - state.promptAt;
          store.gradeItem(GAME_ID, itemKey(state.current), 2, rtMs);
          store.setGameMastery(GAME_ID, computeMastery(store.getProfile()));
          state.locked = true;
        }
      }
      rerender();
    }

    function finishSession() {
      store.setGameMastery(GAME_ID, computeMastery(store.getProfile()));
      state.phase = "done";
      state.celebrated = false;
      rerender();
    }

    function renderMenu() {
      return el("div", { class: "list" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [
            el("div", { class: "title", text: "בעיות מילוליות 🧩" }),
            el("div", { class: "sub", text: "פותרים סיפור קצר ומקלידים רק את התשובה הסופית." }),
          ]),
          el("button", { class: "btn secondary", onClick: () => router.push({ subject: "math" }) }, ["חזרה"]),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "bigPrompt" }, [
            el("div", { text: "📚 12 + 8 = ?" }),
            el("small", { text: "קוראים • חושבים • מקלידים" }),
          ]),
          el("div", { class: "row", style: "justify-content:center" }, [
            el("button", { class: "btn", onClick: startSession }, ["להתחיל ✨"]),
            el("button", { class: "btn secondary", onClick: () => ((state.phase = "settings"), rerender()) }, ["הגדרות"]),
            el("button", { class: "btn secondary", onClick: () => ((state.phase = "report"), rerender()) }, ["דוח 📊"]),
          ]),
        ]),
        renderPatternSummary(),
      ]);
    }

    function renderPatternSummary() {
      return el("div", { class: "card" }, [
        el("div", { class: "title", text: "מה מתרגלים?" }),
        el("div", { class: "sub", text: `${state.cfg.enabledPatternIds.length} תבניות פעילות מתוך ${PROBLEM_PATTERNS.length} • קושי: ${DIFFICULTY_LABELS[state.cfg.difficulty]}` }),
        el("div", { class: "problemPatternChips" }, state.cfg.enabledPatternIds.slice(0, 8).map((id) => el("span", { class: "pill", text: PATTERN_BY_ID[id]?.titleHe || id }))),
      ]);
    }

    function renderSettings() {
      const allEnabled = state.cfg.enabledPatternIds.length === PROBLEM_PATTERNS.length;
      return el("div", { class: "list" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [el("div", { class: "title", text: "הגדרות בעיות מילוליות ⚙️" }), el("div", { class: "sub", text: "בוחרים קושי ותבניות בעיות לתרגול." })]),
          el("button", { class: "btn secondary", onClick: () => ((state.phase = "menu"), rerender()) }, ["חזרה"]),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "row" }, [
            numberSelect("תרגילים", state.cfg.roundsPerSession, [4, 6, 8, 10], (v) => saveCfg({ roundsPerSession: v })),
            selectPill("קושי", state.cfg.difficulty, difficultyOptions().map((id) => ({ id, label: DIFFICULTY_LABELS[id] })), (difficulty) => saveCfg({ difficulty })),
          ]),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "itemRow" }, [
            el("div", {}, [el("div", { class: "title", text: "תבניות פעילות" }), el("div", { class: "sub", text: "כל תבנית משתמשת במספרים חדשים בכל פעם." })]),
            el("button", { class: "btn secondary", onClick: () => saveCfg({ enabledPatternIds: allEnabled ? defaultConfig().enabledPatternIds : PROBLEM_PATTERNS.map((p) => p.id) }) }, [allEnabled ? "בחירה בסיסית" : "הכול"]),
          ]),
          el("div", { class: "problemPatternGrid" }, PROBLEM_PATTERNS.map((pattern) => patternToggle(pattern))),
        ]),
      ]);
    }

    function patternToggle(pattern) {
      const enabled = state.cfg.enabledPatternIds.includes(pattern.id);
      return el("button", {
        class: `problemPatternToggle ${enabled ? "active" : ""}`,
        onClick: () => {
          const next = enabled ? state.cfg.enabledPatternIds.filter((id) => id !== pattern.id) : [...state.cfg.enabledPatternIds, pattern.id];
          saveCfg({ enabledPatternIds: next });
        },
      }, [
        el("strong", { text: pattern.titleHe }),
        el("span", { text: pattern.structure }),
      ]);
    }

    function renderPlay() {
      const p = state.current;
      const remaining = state.cfg.roundsPerSession - state.round;
      return el("div", { class: "list" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [
            el("div", { class: "title", text: `שאלה ${state.round}/${state.cfg.roundsPerSession}` }),
            el("div", { class: "sub", text: remaining ? `נשארו עוד ${remaining} שאלות 🙂` : "שאלה אחרונה! ✨" }),
          ]),
          el("div", { class: "pill" }, [`כוכבים: ${state.score} ⭐`]),
        ]),
        el("div", { class: "card problemCard" }, [
          el("div", { class: "pill" }, [p.patternTitleHe]),
          el("p", { class: "problemText", text: p.text }),
          state.showHint ? el("div", { class: "problemHint", text: `רמז: ${p.hintHe}` }) : null,
          state.locked ? el("div", { class: "problemSolved", text: `התשובה: ${answerText(p)} ✅` }) : null,
        ]),
        renderAnswerPad(),
        el("div", { class: "row" }, [
          el("button", { class: "btn secondary", onClick: () => ((state.showHint = true), rerender()) }, ["רמז"]),
          state.locked ? el("button", { class: "btn", onClick: nextRound }, [state.round >= state.cfg.roundsPerSession ? "לסיום" : "השאלה הבאה ➜"]) : null,
          el("button", { class: "btn danger", onClick: finishSession }, ["לסיים"]),
        ]),
      ]);
    }

    function renderAnswerPad() {
      const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];
      return el("div", { class: "card problemAnswerCard" }, [
        el("label", { class: "problemAnswerLabel" }, ["התשובה שלי"]),
        el("div", { class: "problemAnswerBox", dir: "ltr" }, [state.answer || "?"]),
        el("div", { class: "problemNumpad" }, keys.map((key) => {
          if (key === "clear") return el("button", { class: "problemNumKey muted", onClick: clearAnswer, disabled: state.locked }, ["נקה"]);
          if (key === "back") return el("button", { class: "problemNumKey muted", onClick: backspace, disabled: state.locked }, ["⌫"]);
          return el("button", { class: "problemNumKey", onClick: () => appendDigit(key), disabled: state.locked }, [key]);
        })),
        el("button", { class: "btn problemCheckBtn", onClick: checkAnswer, disabled: state.locked }, ["לבדוק תשובה ✅"]),
      ]);
    }

    function renderDone() {
      const mastery = store.getProfile().gameStats?.[GAME_ID]?.mastery ?? 0;
      if (!state.celebrated) {
        state.celebrated = true;
        showBalloonCelebration({ count: 18, maxSeconds: 8 });
      }
      return el("div", { class: "list" }, [
        el("div", { class: "card" }, [
          el("div", { class: "title", text: "סיימנו סיבוב! 🥳" }),
          el("div", { class: "sub", text: `כוכבים: ${state.score}/${state.cfg.roundsPerSession} • מאסטרי: ${mastery}%` }),
        ]),
        el("div", { class: "row" }, [
          el("button", { class: "btn", onClick: startSession }, ["עוד סיבוב 🔁"]),
          el("button", { class: "btn secondary", onClick: () => ((state.phase = "menu"), rerender()) }, ["לתפריט"]),
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
          el("div", {}, [el("div", { class: "title", text: "דוח בעיות מילוליות 📊" }), el("div", { class: "sub", text: "דיוק, חזרות ומאסטרי לפי תבנית בעיה ותבנית סיפור." })]),
          el("button", { class: "btn secondary", onClick: () => ((state.phase = "menu"), rerender()) }, ["חזרה"]),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "row" }, [
            kpi("מאסטרי", `${mastery}%`),
            kpi("פריטים שנלמדו", String(totalItems || "—")),
            kpi("חזרה עכשיו", totalItems ? `${dueNow}/${totalItems}` : "—"),
          ]),
        ]),
      ]);
    }

    rerender();
  },
};

function numberSelect(label, value, options, onChange) {
  return el("label", { class: "pill" }, [
    el("span", { text: `${label}: ` }),
    el("select", {
      style: "min-height:44px; border-radius:999px; border:1px solid rgba(31,36,48,.12); background:rgba(255,255,255,.8); padding:8px 10px; font-weight:800;",
      onChange: (e) => onChange(Number(e.target.value)),
    }, options.map((v) => el("option", { value: v, text: String(v), ...(v === value ? { selected: true } : {}) }))),
  ]);
}

function selectPill(label, value, options, onChange) {
  return el("label", { class: "pill" }, [
    el("span", { text: `${label}: ` }),
    el("select", {
      style: "min-height:44px; border-radius:999px; border:1px solid rgba(31,36,48,.12); background:rgba(255,255,255,.8); padding:8px 10px; font-weight:800;",
      onChange: (e) => onChange(e.target.value),
    }, options.map((o) => el("option", { value: o.id, text: o.label, ...(o.id === value ? { selected: true } : {}) }))),
  ]);
}

function kpi(k, v) {
  return el("div", { class: "pill" }, [el("div", { class: "kpi" }, [el("div", { class: "k", text: k }), el("div", { class: "v", text: v })])]);
}
