import { clear, el, toast } from "../../../ui/dom.js";
import { nowMs } from "../../../core/time.js";

const GAME_ID = "shape_detective";
const CREATED_AT = 20260520;

const SHAPES = ["rectangle", "square", "parallelogram", "trapezoid", "rhombus", "kite"];

const SHAPE_HE = {
  rectangle: "מלבן",
  square: "ריבוע",
  parallelogram: "מקבילית",
  trapezoid: "טרפז",
  rhombus: "מעוין",
  kite: "דלתון",
};

const DEFINITIONS = {
  parallel_lines: "קווים מקבילים – שני קווים ישרים שאינם נפגשים אף פעם.",
  perpendicular_lines: "קווים מאונכים – שני קווים ישרים היוצרים זוויות ישרות בנקודת המפגש שלהם.",
  trapezoid: "טרפז – מרובע שיש לו רק זוג אחד של צלעות מקבילות.",
  parallelogram: "מקבילית – מרובע שיש לו שני זוגות של צלעות מקבילות.",
  rhombus: "מעוין – מרובע שכל הצלעות שבו שוות באורכן.",
  square: "ריבוע – מרובע שכל הצלעות שבו שוות וכל הזוויות שבו ישרות.",
  rectangle: "מלבן – מרובע שכל הזוויות שבו ישרות.",
  kite: "דלתון – מרובע שיש לו שני זוגות נפרדים של צלעות שוות ולכל זוג כזה יש קודקוד משותף.",
};

const SHAPE_TO_DEFINITION = {
  trapezoid: DEFINITIONS.trapezoid,
  parallelogram: DEFINITIONS.parallelogram,
  rhombus: DEFINITIONS.rhombus,
  square: DEFINITIONS.square,
  rectangle: DEFINITIONS.rectangle,
  kite: DEFINITIONS.kite,
};

function defaultConfig() {
  return { roundsPerSession: 8, rotation: true, enabledShapes: SHAPES, enableNearMiss: true };
}

function normalizeConfig(cfg) {
  const safeShapes = Array.isArray(cfg?.enabledShapes) ? cfg.enabledShapes.filter((s) => SHAPES.includes(s)) : SHAPES;
  return { ...defaultConfig(), ...cfg, enabledShapes: safeShapes.length ? safeShapes : SHAPES };
}

function rand(a) { return a[Math.floor(Math.random() * a.length)]; }
function shuffle(a) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function itemKey(i) { return `${i.mode}|${i.shape}|d${i.difficulty}`; }

function shapePoints(shape, nearMiss = false) {
  const n = nearMiss ? 0.08 : 0;
  if (shape === "rectangle") return [[18, 18], [82, 18 + n * 15], [82, 62], [18, 62 - n * 15]];
  if (shape === "square") return [[25, 15], [75, 15 + n * 18], [75, 65], [25, 65 - n * 18]];
  if (shape === "parallelogram") return [[25, 18], [80, 18], [70, 62], [15, 62]];
  if (shape === "trapezoid") return [[22, 20], [78, 20], [88, 62], [12, 62]];
  if (shape === "rhombus") return [[50, 12], [82, 40], [50, 68], [18, 40]];
  return [[50, 16], [78, 34], [62, 64], [22, 42]];
}

function svgShape(shape, { rotation = 0, nearMiss = false, size = 160 } = {}) {
  const pts = shapePoints(shape, nearMiss).map((p) => p.join(",")).join(" ");
  return `<svg viewBox='0 0 100 80' width='${size}' height='${size * 0.8}' aria-hidden='true'><g transform='rotate(${rotation} 50 40)'><polygon points='${pts}' fill='rgba(124,108,255,.16)' stroke='rgba(55,67,120,.8)' stroke-width='2.2' stroke-linejoin='round'/></g></svg>`;
}

export const GeometryShapeDetectiveGame = {
  id: GAME_ID,
  titleHe: "בלש/ית הצורות",
  subtitleHe: "זיהוי צורות, תכונות וטעויות נפוצות 🔎",
  createdAt: CREATED_AT,

  render({ mount, store }) {
    const state = {
      phase: "menu",
      cfg: normalizeConfig(store.getGameConfig(GAME_ID, defaultConfig(), "geometry")),
      round: 0,
      score: 0,
      promptAt: 0,
      current: null,
      lockUntil: 0,
      rapidWrong: 0,
      feedback: null,
      showDefinitions: false,
    };

    function rerender() {
      clear(mount);
      mount.append(state.phase === "menu" ? renderMenu() : state.phase === "play" ? renderPlay() : renderDone());
      if (state.showDefinitions) mount.append(renderDefinitionsDialog());
    }

    function saveCfg(patch) {
      state.cfg = { ...state.cfg, ...patch };
      store.setGameConfig(GAME_ID, patch, "geometry");
      rerender();
    }

    function makeItem() {
      const shape = rand(state.cfg.enabledShapes);
      const difficulty = Math.min(3, 1 + Math.floor(state.round / 3));
      const modes = ["recognition", "definition", "property_detect"];
      if (state.cfg.enableNearMiss && difficulty > 1) modes.push("near_miss");
      return {
        shape,
        difficulty,
        mode: rand(modes),
        rotation: state.cfg.rotation ? Math.floor(Math.random() * 170) - 85 : 0,
      };
    }

    function startSession() {
      state.phase = "play";
      state.round = 0;
      state.score = 0;
      nextRound();
    }

    function nextRound() {
      state.round += 1;
      state.feedback = null;
      state.current = makeItem();
      state.promptAt = nowMs();
      store.ensureSrItem(GAME_ID, itemKey(state.current));
      rerender();
    }

    function finishSession() {
      state.phase = "done";
      store.setGameMastery(GAME_ID, Math.round((state.score / (state.cfg.roundsPerSession * 2)) * 100));
      rerender();
    }

    function gradeAnswer(ok, partial = false) {
      const rt = Math.max(300, nowMs() - state.promptAt);
      const fast = rt < 900;
      const grade = ok ? (partial ? 3 : 5) : 1;
      store.gradeItem(GAME_ID, itemKey(state.current), grade, rt);
      if (ok) state.score += partial ? 1 : 2;

      if (!ok && fast) {
        state.rapidWrong += 1;
        if (state.rapidWrong >= 2) {
          state.lockUntil = Date.now() + 1200;
          toast("בואו ננסה שוב לאט ובזהירות 👀", 7000);
        }
      } else if (ok) {
        state.rapidWrong = 0;
      }

      if (state.round >= state.cfg.roundsPerSession) finishSession();
      else setTimeout(nextRound, ok ? 550 : 900);
    }

    function onAnswer(choiceKey) {
      if (Date.now() < state.lockUntil) return;
      const cur = state.current;

      if (cur.mode === "recognition") {
        const ok = choiceKey === cur.shape;
        state.feedback = ok ? "מעולה! זיהוי מצוין 🌟" : `כמעט! זאת/זה ${SHAPE_HE[cur.shape]}.`;
        gradeAnswer(ok);
      } else if (cur.mode === "definition") {
        const ok = choiceKey === cur.shape;
        state.feedback = ok ? "נכון מאוד!" : `רמז: ${SHAPE_TO_DEFINITION[cur.shape]}`;
        gradeAnswer(ok);
      } else if (cur.mode === "property_detect") {
        const expect = cur.shape === "rectangle" || cur.shape === "square" || cur.shape === "parallelogram" ? "parallel2" : "parallel1";
        const ok = choiceKey === expect;
        state.feedback = ok ? "אלופה! זיהית מקבילות נכון ✅" : `נסו שוב: ${DEFINITIONS.parallel_lines}`;
        gradeAnswer(ok);
      } else {
        const nearMissCorrect = cur.shape === "square" || cur.shape === "rectangle" ? "no" : "yes";
        const ok = choiceKey === nearMissCorrect;
        state.feedback = ok ? "חשיבה בלשית מעולה!" : "כמעט! בדקו אם כל הזוויות ישרות ואם כל הצלעות עומדות בהגדרה.";
        gradeAnswer(ok, ok && nearMissCorrect === "no");
      }
      rerender();
    }

    function renderMenu() {
      return el("div", { class: "list", dir: "rtl" }, [
        el("div", { class: "card" }, [
          el("div", { class: "title", text: "🔎 בלש/ית הצורות" }),
          el("div", { class: "sub", text: "נזהה צורות לפי מראה ותכונות – עם רמזים נעימים ותיקון טעויות." }),
        ]),
        el("div", { class: "card" }, [
          el("label", { dir: "rtl" }, [
            "מספר סבבים: ",
            el("input", { type: "range", min: "5", max: "12", value: String(state.cfg.roundsPerSession), onInput: (e) => saveCfg({ roundsPerSession: Number(e.target.value) }) }),
            ` ${state.cfg.roundsPerSession}`,
          ]),
          el("div", { class: "row", style: "margin-top:10px;" }, [
            toggle("סיבוב צורות", state.cfg.rotation, (v) => saveCfg({ rotation: v })),
            toggle("מצבי כמעט-נכון", state.cfg.enableNearMiss, (v) => saveCfg({ enableNearMiss: v })),
          ]),
        ]),
        el("div", { class: "row" }, [
          el("button", { class: "btn secondary", onClick: () => { state.showDefinitions = true; rerender(); } }, ["פתיחת דף הגדרות"]),
          el("button", { class: "btn", onClick: startSession }, ["התחלת חקירה 🚀"]),
        ]),
      ]);
    }

    function renderPlay() {
      const c = state.current;
      const near = c.mode === "near_miss";
      return el("div", { class: "list", dir: "rtl" }, [
        el("div", { class: "itemRow card" }, [el("div", {}, [el("div", { class: "title", text: `סבב ${state.round}/${state.cfg.roundsPerSession}` }), el("div", { class: "sub", text: `ניקוד: ${state.score}` })])]),
        el("div", { class: "card" }, [
          el("div", {
            class: "title",
            text:
              c.mode === "recognition"
                ? `בחרו: ${SHAPE_HE[c.shape]}`
                : c.mode === "definition"
                  ? `מי מתאים להגדרה: ${SHAPE_TO_DEFINITION[c.shape]}`
                  : c.mode === "property_detect"
                    ? "כמה זוגות צלעות מקבילות יש לצורה?"
                    : "האם זו צורה תקינה?",
          }),
          el("div", { class: "shapeStage", html: svgShape(c.shape, { rotation: c.rotation, nearMiss: near && (c.shape === "square" || c.shape === "rectangle") }) }),
          c.mode === "near_miss" ? el("div", { class: "sub", text: "שימו לב: לפעמים צורה כמעט נכונה אבל לא בדיוק." }) : null,
          el(
            "div",
            { class: "choices" },
            (
              c.mode === "property_detect"
                ? [{ k: "parallel1", t: "זוג אחד" }, { k: "parallel2", t: "שני זוגות" }]
                : c.mode === "near_miss"
                  ? [{ k: "yes", t: "כן, תקינה" }, { k: "no", t: "לא, יש בעיה" }]
                  : shuffle(state.cfg.enabledShapes).slice(0, 4).map((s) => ({ k: s, t: SHAPE_HE[s] }))
            ).map((o) => el("button", { class: "choiceBtn", onClick: () => onAnswer(o.k), type: "button" }, [o.t]))
          ),
          state.feedback ? el("div", { class: "pill", style: "margin-top:10px;", text: state.feedback, dir: "rtl" }) : null,
        ]),
      ]);
    }

    function renderDone() {
      return el("div", { class: "list", dir: "rtl" }, [
        el("div", { class: "card" }, [
          el("div", { class: "title", text: "סיימנו! 🎉" }),
          el("div", { class: "sub", text: `צברת ${state.score} נקודות. כל הכבוד על חשיבה גיאומטרית!` }),
        ]),
        el("button", { class: "btn", onClick: () => { state.phase = "menu"; rerender(); } }, ["סבב חדש"]),
      ]);
    }

    function renderDefinitionsDialog() {
      return el("div", { class: "card", dir: "rtl", style: "position:fixed; inset: 8% 8%; z-index:40; overflow:auto; max-height:84vh; background:#fff;" }, [
        el("div", { class: "itemRow" }, [
          el("div", { class: "title", text: "דף הגדרות – מרובעים" }),
          el("button", { class: "btn secondary", type: "button", onClick: () => { state.showDefinitions = false; rerender(); } }, ["סגירה"]),
        ]),
        el("div", { class: "list" }, Object.values(DEFINITIONS).map((d) => el("div", { class: "pill", text: d, dir: "rtl" }))),
      ]);
    }

    function toggle(label, value, onChange) {
      return el("button", { class: "btn secondary", onClick: () => onChange(!value), type: "button" }, [`${label}: ${value ? "פעיל" : "כבוי"}`]);
    }

    rerender();
  },
};
