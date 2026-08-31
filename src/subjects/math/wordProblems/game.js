import { clear, el, toast } from "../../../ui/dom.js";
import { isDue } from "../../../core/sr.js";
import { nowMs } from "../../../core/time.js";

const SUBJECT_ID = "math";
const GAME_ID = "word_problems";
const CREATED_AT = 20260831;

const TEMPLATES = [
  {
    id: "stickers_buy",
    type: "add",
    title: "מדבקות במחברת",
    text: (a, b) => `לנועה היו ${a} מדבקות. היא קיבלה עוד ${b} מדבקות מחברה. כמה מדבקות יש לה עכשיו?`,
    answer: (a, b) => a + b,
  },
  {
    id: "books_return",
    type: "sub",
    title: "ספרים בספרייה",
    text: (a, b) => `בספרייה היו ${a} ספרים על המדף. ילדים לקחו ${b} ספרים לקריאה. כמה ספרים נשארו על המדף?`,
    answer: (a, b) => a - b,
  },
  {
    id: "packs_cards",
    type: "mul",
    title: "קלפים בחבילות",
    text: (a, b) => `יש ${a} חבילות קלפים. בכל חבילה יש ${b} קלפים. כמה קלפים יש בסך הכל?`,
    answer: (a, b) => a * b,
  },
  {
    id: "cookies_share",
    type: "div",
    title: "עוגיות לחברים",
    text: (a, b) => `${a} עוגיות חולקו שווה בשווה בין ${b} חברים. כמה עוגיות קיבל כל חבר?`,
    answer: (a, b) => a / b,
  },
];

function defaultConfig() {
  return {
    createdAt: CREATED_AT,
    roundsPerSession: 8,
    worksheetProblems: 10,
    enabledTypes: ["add", "sub", "mul", "div"],
    maxNumber: 40,
  };
}

function normalizeConfig(cfg) {
  const out = { ...cfg };
  const enabled = new Set(Array.isArray(out.enabledTypes) ? out.enabledTypes : []);
  if (!enabled.size) ["add", "sub", "mul", "div"].forEach((x) => enabled.add(x));
  out.enabledTypes = [...enabled].filter((x) => ["add", "sub", "mul", "div"].includes(x));
  if (!out.enabledTypes.length) out.enabledTypes = ["add", "sub"];
  if (!Number.isFinite(out.roundsPerSession) || out.roundsPerSession < 4) out.roundsPerSession = 8;
  if (!Number.isFinite(out.worksheetProblems) || out.worksheetProblems < 6) out.worksheetProblems = 10;
  if (!Number.isFinite(out.maxNumber) || out.maxNumber < 20) out.maxNumber = 40;
  return out;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function itemKey(problem) {
  return `${problem.type}|${problem.templateId}|${problem.a}|${problem.b}`;
}

function makeProblem(cfg, forcedType = null) {
  const type = forcedType || pickRandom(cfg.enabledTypes);
  const template = pickRandom(TEMPLATES.filter((t) => t.type === type));
  let a;
  let b;
  if (type === "add") {
    a = rand(7, cfg.maxNumber);
    b = rand(3, Math.max(5, cfg.maxNumber - a));
  } else if (type === "sub") {
    a = rand(12, cfg.maxNumber);
    b = rand(3, Math.min(a - 1, 18));
  } else if (type === "mul") {
    a = rand(2, 9);
    b = rand(2, 9);
  } else {
    b = rand(2, 9);
    const q = rand(2, 9);
    a = b * q;
  }
  return { templateId: template.id, type, title: template.title, a, b, text: template.text(a, b), answer: template.answer(a, b) };
}

function computeMastery(profile) {
  const items = Object.values(profile.sr?.[GAME_ID] || {});
  if (!items.length) return 0;
  let total = 0;
  let wsum = 0;
  for (const it of items) {
    const attempts = (it.correct || 0) + (it.wrong || 0);
    if (!attempts) continue;
    const w = Math.min(6, 1 + (it.reps || 0));
    total += ((it.correct || 0) / attempts) * w;
    wsum += w;
  }
  return wsum ? Math.round((total / wsum) * 100) : 0;
}

export const MathWordProblemsGame = {
  id: GAME_ID,
  titleHe: "בעיות מילוליות",
  subtitleHe: "פותרים סיפורים קצרים בחשבון, במשחק או בדף עבודה",
  createdAt: CREATED_AT,

  render({ mount, store, screen }) {
    const initialWorksheet = screen?.view === "worksheet";
    const state = {
      phase: initialWorksheet ? "worksheet" : "menu",
      cfg: normalizeConfig(store.getGameConfig(GAME_ID, defaultConfig(), SUBJECT_ID)),
      round: 0,
      score: 0,
      current: null,
      answer: "",
      promptAt: 0,
      worksheet: [],
    };
    store.setGameConfig(GAME_ID, state.cfg, SUBJECT_ID);
    if (initialWorksheet) state.worksheet = makeWorksheetProblems(state.cfg);

    function rerender() {
      clear(mount);
      if (state.phase === "play") mount.append(renderPlay());
      else if (state.phase === "settings") mount.append(renderSettings());
      else if (state.phase === "worksheet") mount.append(renderWorksheet());
      else if (state.phase === "done") mount.append(renderDone());
      else mount.append(renderMenu());
    }

    function saveCfg(patch) {
      state.cfg = normalizeConfig({ ...state.cfg, ...patch });
      store.setGameConfig(GAME_ID, state.cfg, SUBJECT_ID);
      rerender();
    }

    function pickNextProblem() {
      const samples = [];
      for (let i = 0; i < 18; i++) samples.push(makeProblem(state.cfg));
      const due = samples.filter((p) => {
        const sr = store.getSrItem(GAME_ID, itemKey(p));
        return !sr || isDue(sr);
      });
      return pickRandom(due.length ? due : samples);
    }

    function startSession() {
      state.phase = "play";
      state.round = 0;
      state.score = 0;
      nextRound();
    }

    function nextRound() {
      state.round += 1;
      state.answer = "";
      state.current = pickNextProblem();
      state.promptAt = nowMs();
      store.ensureSrItem(GAME_ID, itemKey(state.current));
      rerender();
    }

    function submitAnswer() {
      const numeric = Number(state.answer);
      if (!Number.isFinite(numeric)) return toast("כתבו מספר ואז שלחו 🙂");
      const rt = nowMs() - state.promptAt;
      const ok = numeric === state.current.answer;
      store.gradeItem(GAME_ID, itemKey(state.current), ok ? (rt < 9000 ? 5 : 4) : 1, rt);
      store.setGameMastery(GAME_ID, computeMastery(store.getProfile()));
      if (ok) {
        state.score += 1;
        toast("נכון! ממשיכים ⭐");
        window.setTimeout(() => (state.round >= state.cfg.roundsPerSession ? finishSession() : nextRound()), 260);
      } else {
        toast(`כמעט. רמז: נסו לחשוב איזה פעולה מתאימה לסיפור`);
        rerender();
      }
    }

    function finishSession() {
      state.phase = "done";
      rerender();
    }

    function buildWorksheet() {
      state.worksheet = makeWorksheetProblems(state.cfg);
      state.phase = "worksheet";
      rerender();
    }

    function renderMenu() {
      return el("div", { class: "list" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [
            el("div", { class: "title", text: "בעיות מילוליות בחשבון" }),
            el("div", { class: "sub", text: "בחרו משחק קצר או דף עבודה להדפסה לפי אותן הגדרות" }),
          ]),
          el("div", { class: "row" }, [
            el("button", { class: "btn secondary", onClick: () => ((state.phase = "settings"), rerender()) }, ["⚙️"]),
            el("button", { class: "btn secondary", onClick: buildWorksheet }, ["דף עבודה 🖨️"]),
            el("button", { class: "btn", onClick: startSession }, ["התחל/י"]),
          ]),
        ]),
      ]);
    }

    function renderSettings() {
      const names = { add: "חיבור", sub: "חיסור", mul: "כפל", div: "חילוק" };
      return el("div", { class: "list" }, [
        topRow("הגדרות", "מה יופיע במשחק ובדף העבודה", () => ((state.phase = "menu"), rerender())),
        el("div", { class: "card" }, [
          el("div", { class: "row" }, [
            labelSelect("תרגילים במשחק", state.cfg.roundsPerSession, [6, 8, 10, 12], (v) => saveCfg({ roundsPerSession: v })),
            labelSelect("תרגילים בדף", state.cfg.worksheetProblems, [8, 10, 12, 14], (v) => saveCfg({ worksheetProblems: v })),
            labelSelect("מספר מקסימלי", state.cfg.maxNumber, [30, 40, 60, 100], (v) => saveCfg({ maxNumber: v })),
          ]),
          el("div", { class: "row", style: "margin-top:12px" }, Object.entries(names).map(([id, name]) =>
            el("button", {
              class: "btn secondary",
              onClick: () => {
                const enabled = new Set(state.cfg.enabledTypes);
                if (enabled.has(id)) enabled.delete(id);
                else enabled.add(id);
                if (!enabled.size) return toast("צריך לפחות סוג אחד 🙂");
                saveCfg({ enabledTypes: [...enabled] });
              },
            }, [state.cfg.enabledTypes.includes(id) ? `✅ ${name}` : `⬜ ${name}`])
          )),
        ]),
      ]);
    }

    function renderPlay() {
      return el("div", { class: "list" }, [
        topRow(`שאלה ${state.round}/${state.cfg.roundsPerSession}`, `ניקוד: ${state.score} ⭐`, () => ((state.phase = "menu"), rerender())),
        el("div", { class: "card mathProblemCard" }, [
          el("div", { class: "pill", text: state.current.title }),
          el("div", { class: "mathStory", text: state.current.text }),
          el("div", { class: "row", style: "justify-content:center" }, [
            el("input", {
              class: "answerInput",
              inputmode: "numeric",
              value: state.answer,
              placeholder: "תשובה",
              onInput: (e) => (state.answer = e.target.value),
              onKeydown: (e) => {
                if (e.key === "Enter") submitAnswer();
              },
            }),
            el("button", { class: "btn", onClick: submitAnswer }, ["שליחה"]),
          ]),
        ]),
      ]);
    }

    function renderWorksheet() {
      const date = new Date().toLocaleDateString("he-IL");
      return el("div", { class: "worksheetWrap" }, [
        el("div", { class: "row noPrint", style: "justify-content:space-between; margin-bottom:12px" }, [
          el("button", { class: "btn secondary", onClick: () => ((state.phase = "menu"), rerender()) }, ["חזרה"]),
          el("div", { class: "row" }, [
            el("button", { class: "btn secondary", onClick: buildWorksheet }, ["דף חדש"]),
            el("button", { class: "btn", onClick: () => window.print() }, ["הדפסה 🖨️"]),
          ]),
        ]),
        el("section", { class: "worksheetPage" }, [
          el("div", { class: "worksheetHeader" }, [
            el("div", {}, [el("h2", { text: "בעיות מילוליות בחשבון" }), el("p", { text: `שם: ____________   תאריך: ${date}` })]),
            el("div", { class: "worksheetBadge", text: "משימת חשיבה" }),
          ]),
          el("ol", { class: "worksheetProblems" }, state.worksheet.map((p) =>
            el("li", {}, [
              el("div", { class: "worksheetStory", text: p.text }),
              el("div", { class: "worksheetWork", dir: "ltr" }, [
                el("span", { text: "תרגיל:" }),
                el("span", { class: "worksheetLine", "aria-hidden": "true" }),
                el("span", { text: "תשובה:" }),
                el("span", { class: "worksheetAnswerLine", "aria-hidden": "true" }),
              ]),
            ])
          )),
          el("div", { class: "worksheetFooter", text: "בדקו: האם התשובה הגיונית לפי הסיפור?" }),
        ]),
      ]);
    }

    function renderDone() {
      return el("div", { class: "list" }, [
        topRow("סיימנו!", `ניקוד: ${state.score}/${state.cfg.roundsPerSession} ⭐`, () => ((state.phase = "menu"), rerender())),
        el("div", { class: "row" }, [
          el("button", { class: "btn", onClick: startSession }, ["עוד סיבוב"]),
          el("button", { class: "btn secondary", onClick: buildWorksheet }, ["דף עבודה"]),
        ]),
      ]);
    }

    rerender();
  },
};

function makeWorksheetProblems(cfg) {
  const out = [];
  const types = cfg.enabledTypes;
  for (let i = 0; i < cfg.worksheetProblems; i++) out.push(makeProblem(cfg, types[i % types.length]));
  return out;
}

function topRow(title, sub, onBack) {
  return el("div", { class: "itemRow noPrint" }, [
    el("div", {}, [el("div", { class: "title", text: title }), el("div", { class: "sub", text: sub })]),
    el("button", { class: "btn secondary", onClick: onBack }, ["חזרה"]),
  ]);
}

function labelSelect(label, value, options, onChange) {
  return el("label", { class: "pill" }, [
    el("span", { text: `${label}: ` }),
    el("select", { onChange: (e) => onChange(Number(e.target.value)) }, options.map((v) => el("option", { value: v, text: String(v), selected: v === value }))),
  ]);
}
