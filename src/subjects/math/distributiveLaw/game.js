import { el, toast, clear } from "../../../ui/dom.js";
import { nowMs } from "../../../core/time.js";
import { isDue } from "../../../core/sr.js";
import { playOneShot, preloadAudio } from "../../../core/audio.js";
import { showBalloonCelebration } from "../../../ui/celebrations/balloons.js";

const GAME_ID = "distributive_law";
const CREATED_AT = 20260515;
const SUBJECT_ID = "math";
const THEMES = ["🍎", "⭐", "🐸", "🚗", "🍕", "🦕"];

function defaultConfig() {
  return {
    createdAt: CREATED_AT,
    roundsPerSession: 6,
    themeEmoji: "⭐",
    firstMin: 2,
    firstMax: 6,
    tensMin: 1,
    tensMax: 3,
    onesMin: 1,
    onesMax: 6,
  };
}

function normalizeConfig(cfg) {
  const n = { ...defaultConfig(), ...cfg };
  for (const k of ["roundsPerSession", "firstMin", "firstMax", "tensMin", "tensMax", "onesMin", "onesMax"]) {
    n[k] = Math.max(0, Math.min(99, Number(n[k]) || 0));
  }
  n.roundsPerSession = clamp(n.roundsPerSession, 4, 10);
  n.firstMin = clamp(n.firstMin, 0, 10);
  n.firstMax = clamp(Math.max(n.firstMin, n.firstMax), 0, 10);
  n.tensMin = clamp(n.tensMin, 1, 9);
  n.tensMax = clamp(Math.max(n.tensMin, n.tensMax), 1, 9);
  n.onesMin = clamp(n.onesMin, 0, 9);
  n.onesMax = clamp(Math.max(n.onesMin, n.onesMax), 0, 9);
  if (!THEMES.includes(n.themeEmoji)) n.themeEmoji = THEMES[1];
  return n;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function itemKey({ a, b, tens, ones }) {
  return `${a}|${b}|${tens}+${ones}`;
}

function buildItemPool(cfg) {
  const pool = [];
  for (let a = cfg.firstMin; a <= cfg.firstMax; a++) {
    if (a === 0) continue;
    for (let t = cfg.tensMin; t <= cfg.tensMax; t++) {
      for (let o = cfg.onesMin; o <= cfg.onesMax; o++) {
        const b = t * 10 + o;
        if (b < 10 || b > 99) continue;
        if (o === 0 && cfg.onesMax > 0) continue;
        pool.push(makeItem(a, b));
      }
    }
  }
  return pool.length ? pool : [makeItem(3, 12), makeItem(4, 21), makeItem(5, 23)];
}

function makeItem(a, b) {
  const tens = Math.floor(b / 10) * 10;
  const ones = b - tens;
  return {
    a,
    b,
    tens,
    ones,
    total: a * b,
    leftProduct: a * tens,
    rightProduct: a * ones,
  };
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
  return wsum ? Math.round((total / wsum) * 100) : 0;
}

function equationBlanks(it) {
  return [
    { id: "a1", value: it.a, label: "המספר הראשון" },
    { id: "tens", value: it.tens, label: "עשרות" },
    { id: "ones", value: it.ones, label: "אחדות" },
    { id: "a2", value: it.a, label: "פעם שנייה" },
    { id: "tens2", value: it.tens, label: "חלק עשרות" },
    { id: "a3", value: it.a, label: "פעם שלישית" },
    { id: "ones2", value: it.ones, label: "חלק אחדות" },
    { id: "left", value: it.leftProduct, label: "מכפלת העשרות" },
    { id: "right", value: it.rightProduct, label: "מכפלת האחדות" },
    { id: "total", value: it.total, label: "התוצאה" },
  ];
}

function uniqueNumberCards(it) {
  const rightDistractors = [it.total + it.a, Math.max(0, it.total - it.a), it.tens + it.ones, it.b];
  return [...new Set([...equationBlanks(it).map((x) => x.value), ...rightDistractors])]
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
}

export const MathDistributiveLawGame = {
  id: GAME_ID,
  titleHe: "חוק הפילוג",
  subtitleHe: "חותכים מלבן כפל לעשרות ואחדות ומחברים בחזרה ✂️",
  createdAt: CREATED_AT,

  render({ mount, store, router }) {
    const state = {
      phase: "menu", // menu | play | settings | report | done
      cfg: normalizeConfig(store.getGameConfig(GAME_ID, defaultConfig(), SUBJECT_ID)),
      round: 0,
      score: 0,
      current: null,
      promptAt: 0,
      selectedSplit: null,
      splitStatus: "idle", // idle | preview | separated | recombined | complete
      splitWasWrong: false,
      filled: {},
      selectedBlank: "",
      wrongBlank: "",
      quickErrors: 0,
      lastErrorAt: 0,
      celebrated: false,
    };

    store.setGameConfig(GAME_ID, { ...state.cfg }, SUBJECT_ID);
    preloadAudio(["./public/audio/answer-correct.mp3"]);

    function rerender() {
      clear(mount);
      if (state.phase === "menu") mount.append(renderMenu());
      else if (state.phase === "settings") mount.append(renderSettings());
      else if (state.phase === "report") mount.append(renderReport());
      else if (state.phase === "done") mount.append(renderDone());
      else mount.append(renderPlay());
    }

    function saveCfg(patch) {
      state.cfg = normalizeConfig({ ...state.cfg, ...patch });
      store.setGameConfig(GAME_ID, patch, SUBJECT_ID);
      rerender();
    }

    function applyPreset(name) {
      const presets = {
        beginner: { firstMin: 2, firstMax: 5, tensMin: 1, tensMax: 2, onesMin: 1, onesMax: 5, roundsPerSession: 6 },
        intermediate: { firstMin: 2, firstMax: 8, tensMin: 2, tensMax: 5, onesMin: 1, onesMax: 9, roundsPerSession: 8 },
        advanced: { firstMin: 2, firstMax: 10, tensMin: 1, tensMax: 9, onesMin: 1, onesMax: 9, roundsPerSession: 10 },
      };
      saveCfg(presets[name]);
    }

    function pickNextItem() {
      const pool = buildItemPool(state.cfg);
      const due = pool.filter((it) => {
        const sr = store.getSrItem(GAME_ID, itemKey(it));
        return !sr || isDue(sr);
      });
      const candidates = due.length ? due : pool;
      const sorted = candidates
        .map((it) => ({ it, sr: store.getSrItem(GAME_ID, itemKey(it)) }))
        .sort((a, b) => (a.sr?.lastAt || 0) - (b.sr?.lastAt || 0));
      return pickRandom(sorted.slice(0, Math.max(4, Math.ceil(sorted.length / 3)))).it;
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
      state.current = pickNextItem();
      state.promptAt = nowMs();
      state.selectedSplit = null;
      state.splitStatus = "idle";
      state.splitWasWrong = false;
      state.filled = {};
      state.selectedBlank = "";
      state.wrongBlank = "";
      store.ensureSrItem(GAME_ID, itemKey(state.current));
      rerender();
    }

    function recordQuickError() {
      const t = nowMs();
      if (t - state.lastErrorAt < 900) state.quickErrors += 1;
      else state.quickErrors = Math.max(0, state.quickErrors - 1);
      state.lastErrorAt = t;
      if (state.quickErrors >= 2) {
        state.quickErrors = 0;
        toast("בואי נעצור רגע ונחפש את העשרות 🙂", 1800);
      }
    }

    function chooseSplit(col) {
      if (state.splitStatus === "complete") return;
      state.selectedSplit = col;
      state.splitStatus = "preview";
      state.splitWasWrong = false;
      rerender();
    }

    function separateGrid() {
      if (!state.current || state.selectedSplit == null) return;
      state.splitStatus = "separated";
      const ok = state.selectedSplit === state.current.tens;
      state.splitWasWrong = !ok;
      if (ok) toast("בול! פירקנו לעשרות ואחדות ✨");
      else {
        recordQuickError();
        toast("כמעט. נסי לחתוך במספר עגול של עשרות ✋", 1800);
      }
      rerender();
    }

    function retrySplit() {
      state.selectedSplit = null;
      state.splitStatus = "idle";
      state.splitWasWrong = false;
      rerender();
    }

    function recombineGrid() {
      if (!state.current || state.selectedSplit !== state.current.tens) return;
      state.splitStatus = "recombined";
      toast("המלבן התחבר — עכשיו נשלים את התרגיל 🧩");
      rerender();
    }

    function fillBlank(blankId, value) {
      if (state.splitStatus !== "recombined") {
        toast("קודם נחתוך ונחבר את המלבן 🙂");
        return;
      }
      const blank = equationBlanks(state.current).find((x) => x.id === blankId);
      if (!blank || state.filled[blankId] != null) return;
      if (Number(value) === blank.value) {
        state.filled[blankId] = value;
        state.selectedBlank = "";
        state.wrongBlank = "";
        playOneShot("./public/audio/answer-correct.mp3");
        const done = equationBlanks(state.current).every((x) => state.filled[x.id] != null);
        if (done) completeRound();
      } else {
        state.wrongBlank = blankId;
        recordQuickError();
        toast(`זה לא ${blank.label}. נסי קלף אחר 🌱`, 1600);
      }
      rerender();
    }

    function completeRound() {
      const rtMs = nowMs() - state.promptAt;
      const grade = state.splitWasWrong ? 4 : 5;
      store.gradeItem(GAME_ID, itemKey(state.current), grade, rtMs);
      store.setGameMastery(GAME_ID, computeMastery(store.getProfile()));
      state.score += grade === 5 ? 1 : 0;
      state.splitStatus = "complete";
      toast("התרגיל הושלם! ✅", 1600);
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
            el("div", { class: "title", text: "חוק הפילוג 🧮" }),
            el("div", { class: "sub", text: "נחתוך מלבן כפל לעשרות ואחדות, נפתור חלקים ונחבר." }),
          ]),
          el("button", { class: "btn secondary", onClick: () => router.push({ subject: "math" }) }, ["חזרה"]),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "bigPrompt" }, [
            el("div", { text: `${state.cfg.themeEmoji} 5 × 23` }),
            el("small", { text: "5 × (20 + 3) = 100 + 15" }),
          ]),
          el("div", { class: "row", style: "justify-content:center" }, [
            el("button", { class: "btn", onClick: startSession }, ["להתחיל ✨"]),
            el("button", { class: "btn secondary", onClick: () => ((state.phase = "settings"), rerender()) }, ["הגדרות"]),
            el("button", { class: "btn secondary", onClick: () => ((state.phase = "report"), rerender()) }, ["דוח 📊"]),
          ]),
        ]),
        renderThemePicker(),
      ]);
    }

    function renderThemePicker() {
      return el("div", { class: "card" }, [
        el("div", { class: "title", text: "איזה פריטים יהיו בגריד?" }),
        el("div", { class: "mathThemeRow" }, THEMES.map((emoji) =>
          el("button", { class: `mathTheme ${emoji === state.cfg.themeEmoji ? "active" : ""}`, onClick: () => saveCfg({ themeEmoji: emoji }) }, [emoji])
        )),
      ]);
    }

    function renderSettings() {
      return el("div", { class: "list" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [el("div", { class: "title", text: "הגדרות חוק הפילוג ⚙️" }), el("div", { class: "sub", text: "אפשר להתאים את הטווחים לקצב הלמידה." })]),
          el("button", { class: "btn secondary", onClick: () => ((state.phase = "menu"), rerender()) }, ["חזרה"]),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "title", text: "קיצורי קושי" }),
          el("div", { class: "row", style: "margin-top:10px" }, [
            el("button", { class: "btn secondary", onClick: () => applyPreset("beginner") }, ["מתחיל"]),
            el("button", { class: "btn secondary", onClick: () => applyPreset("intermediate") }, ["מתקדם"]),
            el("button", { class: "btn secondary", onClick: () => applyPreset("advanced") }, ["אתגר"]),
          ]),
        ]),
        el("div", { class: "card" }, [
          el("div", { class: "row" }, [
            numberSelect("תרגילים", state.cfg.roundsPerSession, [4, 6, 8, 10], (v) => saveCfg({ roundsPerSession: v })),
            numberSelect("מספר ראשון מ־", state.cfg.firstMin, range(0, state.cfg.firstMax), (v) => saveCfg({ firstMin: v })),
            numberSelect("מספר ראשון עד", state.cfg.firstMax, range(state.cfg.firstMin, 10), (v) => saveCfg({ firstMax: v })),
            numberSelect("עשרות מ־", state.cfg.tensMin, range(1, state.cfg.tensMax), (v) => saveCfg({ tensMin: v })),
            numberSelect("עשרות עד", state.cfg.tensMax, range(state.cfg.tensMin, 9), (v) => saveCfg({ tensMax: v })),
            numberSelect("אחדות מ־", state.cfg.onesMin, range(0, state.cfg.onesMax), (v) => saveCfg({ onesMin: v })),
            numberSelect("אחדות עד", state.cfg.onesMax, range(state.cfg.onesMin, 9), (v) => saveCfg({ onesMax: v })),
          ]),
        ]),
        renderThemePicker(),
      ]);
    }

    function renderPlay() {
      const it = state.current;
      const remaining = state.cfg.roundsPerSession - state.round;
      return el("div", { class: "list" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [
            el("div", { class: "title", text: `תרגיל ${state.round}/${state.cfg.roundsPerSession}: ${it.a} × ${it.b}` }),
            el("div", { class: "sub", text: remaining ? `נשארו עוד ${remaining} תרגילים 🙂` : "תרגיל אחרון! ✨" }),
          ]),
          el("div", { class: "pill" }, [`כוכבים: ${state.score} ⭐`]),
        ]),
        renderGridCard(it),
        renderEquationCard(it),
        el("div", { class: "row" }, [
          el("button", { class: "btn secondary", onClick: () => ((state.phase = "menu"), rerender()) }, ["הגדרות"]),
          el("button", { class: "btn danger", onClick: finishSession }, ["לסיים"]),
        ]),
      ]);
    }

    function renderGridCard(it) {
      const split = state.selectedSplit;
      const correctSplit = it.tens;
      const selectedText = split == null ? "בחרי קו חיתוך אחרי העשרות" : `${split} + ${it.b - split}`;
      const canSeparate = split != null && state.splitStatus === "preview";
      const canRecombine = state.splitStatus === "separated" && split === correctSplit;
      return el("div", { class: "card mathGridCard" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [
            el("div", { class: "title", text: "מלבן הכפל" }),
            el("div", { class: "sub", text: `המטרה: ${it.b} = ${it.tens} + ${it.ones}` }),
          ]),
          el("div", { class: "pill" }, [selectedText]),
        ]),
        renderAreaGrid(it),
        renderSplitLabels(it),
        el("div", { class: "row", style: "justify-content:center; margin-top:12px" }, [
          canSeparate ? el("button", { class: "btn", onClick: separateGrid }, ["להפריד ✂️"]) : null,
          canRecombine ? el("button", { class: "btn", onClick: recombineGrid }, ["לחבר בחזרה 🧲"]) : null,
          state.splitWasWrong ? el("button", { class: "btn secondary", onClick: retrySplit }, ["לנסות חיתוך אחר"]) : null,
          state.splitStatus === "complete" ? el("button", { class: "btn", onClick: nextRound }, [state.round >= state.cfg.roundsPerSession ? "לסיום" : "התרגיל הבא ➜"]) : null,
        ]),
      ]);
    }

    function renderAreaGrid(it) {
      const cells = [];
      for (let r = 1; r <= it.a; r++) {
        for (let c = 1; c <= it.b; c++) {
          const isLeft = state.selectedSplit != null && c <= state.selectedSplit;
          const isRight = state.selectedSplit != null && c > state.selectedSplit;
          const atSplit = state.selectedSplit === c;
          const tensGuide = c % 10 === 0;
          cells.push(el("button", {
            class: `mathCell ${isLeft ? "left" : ""} ${isRight ? "right" : ""} ${atSplit ? "splitEdge" : ""} ${tensGuide ? "tensGuide" : ""}`,
            onClick: () => chooseSplit(c),
            title: `עמודה ${c}`,
          }, [state.cfg.themeEmoji]));
        }
      }
      return el("div", {
        class: `mathAreaGrid ${state.splitStatus} ${state.splitWasWrong ? "wrongSplit" : ""}`,
        style: `--cols:${it.b}; --rows:${it.a};`,
      }, cells);
    }

    function renderSplitLabels(it) {
      if (state.selectedSplit == null) {
        return el("div", { class: "mathHint", text: "רמז: הקווים העדינים מופיעים כל 10 עמודות." });
      }
      const right = it.b - state.selectedSplit;
      return el("div", { class: "mathSplitLabels" }, [
        el("div", { class: state.selectedSplit === it.tens ? "good" : "bad", text: `${it.a} × ${state.selectedSplit}` }),
        el("div", { class: state.selectedSplit === it.tens ? "good" : "bad", text: `${it.a} × ${right}` }),
      ]);
    }

    function renderEquationCard(it) {
      const unlocked = state.splitStatus === "recombined" || state.splitStatus === "complete";
      const blanks = Object.fromEntries(equationBlanks(it).map((b) => [b.id, b]));
      return el("div", { class: `card mathEquationCard ${unlocked ? "" : "locked"}` }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [el("div", { class: "title", text: "משלימים את חוק הפילוג" }), el("div", { class: "sub", text: unlocked ? "הקישי על משבצת ואז על קלף מספר." : "ייפתח אחרי חיתוך נכון וחיבור מחדש." })]),
        ]),
        el("div", { class: "mathEquation", dir: "ltr" }, [
          line([`${it.a} × ${it.b}`]),
          line(["=", blank(blanks.a1), "× (", blank(blanks.tens), "+", blank(blanks.ones), ")"]),
          line(["=", blank(blanks.a2), "×", blank(blanks.tens2), "+", blank(blanks.a3), "×", blank(blanks.ones2)]),
          line(["=", blank(blanks.left), "+", blank(blanks.right)]),
          line(["=", blank(blanks.total)]),
        ]),
        el("div", { class: "mathCards" }, uniqueNumberCards(it).map((num) =>
          el("button", { class: "mathNumberCard", disabled: !unlocked, onClick: () => fillFirstOpenBlank(num) }, [String(num)])
        )),
      ]);
    }

    function fillFirstOpenBlank(num) {
      const selected = state.selectedBlank && equationBlanks(state.current).find((x) => x.id === state.selectedBlank && state.filled[x.id] == null);
      const next = selected || equationBlanks(state.current).find((x) => state.filled[x.id] == null);
      if (next) fillBlank(next.id, num);
    }

    function chooseBlank(b) {
      if (state.filled[b.id] != null) {
        toast("כבר מילאנו את זה ✅");
        return;
      }
      state.selectedBlank = b.id;
      toast(`עכשיו בוחרים קלף עבור: ${b.label}`);
      rerender();
    }

    function blank(b) {
      const value = state.filled[b.id];
      return el("button", {
        class: `mathBlank ${value != null ? "filled" : ""} ${state.selectedBlank === b.id ? "active" : ""} ${state.wrongBlank === b.id ? "bad" : ""}`,
        onClick: () => chooseBlank(b),
      }, [value == null ? "?" : String(value)]);
    }

    function line(parts) {
      return el("div", { class: "mathEquationLine" }, parts.map((p) => (typeof p === "string" ? el("span", { text: p }) : p)));
    }

    function renderDone() {
      const mastery = store.getProfile().gameStats?.[GAME_ID]?.mastery ?? 0;
      if (!state.celebrated) {
        state.celebrated = true;
        showBalloonCelebration({ count: 18, maxSeconds: 8 });
      }
      return el("div", { class: "list" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [
            el("div", { class: "title", text: "סיימנו סיבוב! 🥳" }),
            el("div", { class: "sub", text: `כוכבים: ${state.score}/${state.cfg.roundsPerSession} • מאסטרי: ${mastery}%` }),
          ]),
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
          el("div", {}, [el("div", { class: "title", text: "דוח חוק הפילוג 📊" }), el("div", { class: "sub", text: "דיוק, חזרות ומאסטרי לפי תרגילי כפל." })]),
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

function range(min, max) {
  const out = [];
  for (let i = min; i <= max; i++) out.push(i);
  return out;
}

function kpi(k, v) {
  return el("div", { class: "pill" }, [el("div", { class: "kpi" }, [el("div", { class: "k", text: k }), el("div", { class: "v", text: v })])]);
}
