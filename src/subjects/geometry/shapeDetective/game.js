import { clear, el, toast } from "../../../ui/dom.js";
import { nowMs } from "../../../core/time.js";

const GAME_ID = "shape_detective";
const CREATED_AT = 20260520;

const SHAPES = ["rectangle", "square", "parallelogram", "trapezoid", "rhombus", "kite"];
const GENERIC_QUAD = "generic_quadrilateral";

const SHAPE_HE = {
  rectangle: "מלבן",
  square: "ריבוע",
  parallelogram: "מקבילית",
  trapezoid: "טרפז",
  rhombus: "מעוין",
  kite: "דלתון",
};
function shapeLabel(shape) {
  return shape === GENERIC_QUAD ? "מרובע" : SHAPE_HE[shape];
}

const DEFINITIONS = {
  parallel_lines: "קווים מקבילים – שני קווים ישרים שאינם נפגשים אף פעם.",
  perpendicular_lines: "קווים מאונכים – שני קווים ישרים היוצרים זוויות ישרות בנקודת המפגש שלהם.",
  trapezoid: "טרפז – מרובע שיש לו רק זוג אחד של צלעות מקבילות.",
  parallelogram: "מקבילית – מרובע שיש לו שני זוגות של צלעות מקבילות.",
  rhombus: "מעוין – מרובע שכל הצלעות שבו שוות באורכן.",
  square: "ריבוע – מרובע שכל הצלעות שבו שוות וכל הזוויות שבו ישרות.",
  rectangle: "מלבן – מרובע שכל הזוויות שבו ישרות.",
  kite: "דלתון – מרובע שיש לו שני זוגות נפרדים של צלעות שוות ולכל זוג כזה יש קודקוד משותף.",
  generic_quadrilateral: "מרובע – צורה בעלת ארבע צלעות.",
};

const SHAPE_TO_DEFINITION = {
  trapezoid: DEFINITIONS.trapezoid,
  parallelogram: DEFINITIONS.parallelogram,
  rhombus: DEFINITIONS.rhombus,
  square: DEFINITIONS.square,
  rectangle: DEFINITIONS.rectangle,
  kite: DEFINITIONS.kite,
};
const DEFINITION_GAME_SHAPES = [...SHAPES, GENERIC_QUAD];

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
function signedArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - y1 * x2;
  }
  return area / 2;
}
function angleAt(points, i) {
  const n = points.length;
  const prev = points[(i - 1 + n) % n];
  const cur = points[i];
  const next = points[(i + 1) % n];
  const v1 = [prev[0] - cur[0], prev[1] - cur[1]];
  const v2 = [next[0] - cur[0], next[1] - cur[1]];
  const dot = v1[0] * v2[0] + v1[1] * v2[1];
  const mag = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);
  if (!mag) return 180;
  return Math.acos(Math.min(1, Math.max(-1, dot / mag))) * (180 / Math.PI);
}

function edgeLengths(points) {
  return points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
}
function relativeDifference(a, b) {
  const base = Math.max(a, b);
  return base ? Math.abs(a - b) / base : 0;
}
function respectsShapeDistinction(shape, points) {
  const lengths = edgeLengths(points);
  const [l0, l1, l2, l3] = lengths;
  if (shape === 'rectangle') {
    const width = (l0 + l2) / 2;
    const height = (l1 + l3) / 2;
    return relativeDifference(width, height) >= 0.30;
  }
  if (shape === 'kite') {
    const pairA = (l0 + l1) / 2;
    const pairB = (l2 + l3) / 2;
    return relativeDifference(pairA, pairB) >= 0.30;
  }
  if (shape === 'trapezoid') {
    return points.every((_, i) => {
      const a = angleAt(points, i);
      return a <= 80 || a >= 100;
    });
  }
  return true;
}

function validNonRightishQuad(points) {
  if (signedArea(points) <= 0) return false;
  return points.every((_, i) => {
    const a = angleAt(points, i);
    return a < 84 || a > 96;
  });
}
function randomGenericQuadrilateral() {
  for (let i = 0; i < 120; i++) {
    const points = [
      [15 + Math.random() * 18, 12 + Math.random() * 24],
      [62 + Math.random() * 23, 10 + Math.random() * 28],
      [64 + Math.random() * 24, 50 + Math.random() * 19],
      [9 + Math.random() * 28, 46 + Math.random() * 24],
    ];
    if (validNonRightishQuad(points)) return points;
  }
  return [[18, 16], [84, 24], [72, 66], [12, 54]];
}
function jitterShapePoints(shape) {
  if (shape === GENERIC_QUAD) return randomGenericQuadrilateral();
  const base = shapePoints(shape, false);
  for (let i = 0; i < 120; i++) {
    const points = base.map(([x, y]) => [x + (Math.random() * 8 - 4), y + (Math.random() * 8 - 4)]);
    const nonRightishOk = (shape === "rectangle" || shape === "square") ? true : validNonRightishQuad(points);
    if (nonRightishOk && respectsShapeDistinction(shape, points)) return points;
  }
  return base;
}

function shapePoints(shape, nearMiss = false, customPoints = null) {
  if (shape === GENERIC_QUAD && Array.isArray(customPoints)) return customPoints;
  const n = nearMiss ? 0.08 : 0;
  if (shape === "rectangle") return [[18, 18], [86, 18 + n * 12], [86, 56], [18, 56 - n * 12]];
  if (shape === "square") return [[25, 15], [75, 15 + n * 18], [75, 65], [25, 65 - n * 18]];
  if (shape === "parallelogram") return [[25, 18], [80, 18], [70, 62], [15, 62]];
  if (shape === "trapezoid") return [[26, 18], [74, 18], [90, 62], [10, 58]];
  if (shape === "rhombus") return [[50, 12], [82, 40], [50, 68], [18, 40]];
  return [[40, 16], [72, 32], [58, 66], [18, 52]];
}

function svgShape(shape, { rotation = 0, nearMiss = false, size = 160, customPoints = null } = {}) {
  const pts = shapePoints(shape, nearMiss, customPoints).map((p) => p.join(",")).join(" ");
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
      const targetShapeForText = rand(DEFINITION_GAME_SHAPES);
      const difficulty = Math.min(3, 1 + Math.floor(state.round / 3));
      const useGeneric = difficulty > 1 && Math.random() < 0.3;
      const modes = useGeneric
        ? ["shape_to_name", "shape_to_definition", "definition_to_shape", "name_to_shape", "definition_to_name", "name_to_definition", "property_detect", "odd_one_out"]
        : ["shape_to_name", "shape_to_definition", "definition_to_shape", "name_to_shape", "definition_to_name", "name_to_definition", "property_detect", "odd_one_out"];
      if (!useGeneric && state.cfg.enableNearMiss && difficulty > 1) modes.push("near_miss");
      const oddMain = rand(state.cfg.enabledShapes);
      const oddPool = state.cfg.enabledShapes.filter((s) => s !== oddMain);
      const oddDifferent = rand(oddPool.length ? oddPool : SHAPES.filter((s) => s !== oddMain));
      const oddChoices = shuffle([
        { id: "a", shape: oddMain, customPoints: jitterShapePoints(oddMain) },
        { id: "b", shape: oddMain, customPoints: jitterShapePoints(oddMain) },
        { id: "c", shape: oddMain, customPoints: jitterShapePoints(oddMain) },
        { id: "d", shape: oddDifferent, customPoints: jitterShapePoints(oddDifferent) },
      ]);
      const pickPool = DEFINITION_GAME_SHAPES.filter((s) => s !== targetShapeForText);
      const randomChoice = () => {
        const pickShape = rand(pickPool);
        return { shape: pickShape, customPoints: jitterShapePoints(pickShape) };
      };
      const shapePickChoices = shuffle([
        { id: "a", shape: targetShapeForText, customPoints: jitterShapePoints(targetShapeForText) },
        { id: "b", ...randomChoice() },
        { id: "c", ...randomChoice() },
        { id: "d", ...randomChoice() },
      ]);
      return {
        shape: useGeneric ? GENERIC_QUAD : shape,
        targetShapeForText,
        difficulty,
        mode: rand(modes),
        rotation: state.cfg.rotation ? Math.floor(Math.random() * 170) - 85 : 0,
        customPoints: useGeneric ? randomGenericQuadrilateral() : null,
        oddMain,
        oddDifferent,
        oddChoices,
        shapePickChoices,
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

      if (cur.mode === "shape_to_name") {
        const ok = choiceKey === cur.shape;
        state.feedback = ok ? "מעולה! זיהוי מצוין 🌟" : `כמעט! זאת/זה ${SHAPE_HE[cur.shape]}.`;
        gradeAnswer(ok);
      } else if (cur.mode === "shape_to_definition") {
        const ok = choiceKey === cur.shape;
        state.feedback = ok ? "נכון מאוד!" : `רמז: ${SHAPE_TO_DEFINITION[cur.shape]}`;
        gradeAnswer(ok);
      } else if (cur.mode === "definition_to_shape") {
        const pick = cur.shapePickChoices.find((x) => x.id === choiceKey);
        const ok = pick?.shape === cur.targetShapeForText;
        state.feedback = ok ? "מעולה! התאמת הגדרה לצורה 👏" : `כמעט! נסו למצוא ${shapeLabel(cur.targetShapeForText)}.`;
        gradeAnswer(ok);
      } else if (cur.mode === "name_to_shape") {
        const pick = cur.shapePickChoices.find((x) => x.id === choiceKey);
        const ok = pick?.shape === cur.targetShapeForText;
        state.feedback = ok ? "נכון מאוד! מצאתם לפי השם 🎯" : `כמעט! זו הצורה ${shapeLabel(cur.targetShapeForText)}.`;
        gradeAnswer(ok);
      } else if (cur.mode === "definition_to_name") {
        const ok = choiceKey === cur.targetShapeForText;
        state.feedback = ok ? "כל הכבוד! הגדרה לשם ✅" : "כמעט! קראו את ההגדרה שוב וחפשו את השם המתאים.";
        gradeAnswer(ok);
      } else if (cur.mode === "name_to_definition") {
        const ok = choiceKey === cur.targetShapeForText;
        state.feedback = ok ? "אלופה! שם להגדרה 💡" : "עוד ניסיון קטן: חפשו את ההגדרה שמתארת בדיוק את השם.";
        gradeAnswer(ok);
      } else if (cur.mode === "property_detect") {
        const expect = cur.shape === "rectangle" || cur.shape === "square" || cur.shape === "parallelogram" ? "parallel2" : "parallel1";
        const ok = choiceKey === expect;
        state.feedback = ok ? "אלופה! זיהית מקבילות נכון ✅" : `נסו שוב: ${DEFINITIONS.parallel_lines}`;
        gradeAnswer(ok);
      } else if (cur.mode === "odd_one_out") {
        const oddPick = cur.oddChoices.find((x) => x.id === choiceKey);
        const ok = oddPick?.shape === cur.oddDifferent;
        state.feedback = ok ? "בול! מצאת את היוצא דופן 🕵️" : `כמעט! היוצא דופן היה ${SHAPE_HE[cur.oddDifferent]}.`;
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
              c.mode === "shape_to_name"
                  ? "מה השם של הצורה המוצגת?"
                  : c.mode === "shape_to_definition"
                    ? "בחרו את ההגדרה שמתאימה לצורה המוצגת:"
                    : c.mode === "definition_to_shape"
                      ? `בחרו את הצורה שמתאימה להגדרה: ${DEFINITIONS[c.targetShapeForText].replace(/^[^–]+–\s*/, "")}`
                      : c.mode === "name_to_shape"
                        ? `בחרו את הצורה: ${shapeLabel(c.targetShapeForText)}`
                        : c.mode === "definition_to_name"
                          ? `איזה שם מתאים להגדרה: ${DEFINITIONS[c.targetShapeForText].replace(/^[^–]+–\s*/, "")}`
                          : c.mode === "name_to_definition"
                            ? `איזו הגדרה מתאימה ל-${shapeLabel(c.targetShapeForText)}?`
                  : c.mode === "property_detect"
                    ? "כמה זוגות צלעות מקבילות יש לצורה?"
                      : c.mode === "odd_one_out"
                        ? "מי הצורה היוצאת דופן?"
                    : "האם זו צורה תקינה?",
          }),
          ["definition_to_shape", "name_to_shape", "odd_one_out"].includes(c.mode)
            ? el("div", { class: "choices" }, (c.mode === "odd_one_out" ? c.oddChoices : c.shapePickChoices).map((o) => el("button", { class: "choiceBtn", onClick: () => onAnswer(o.id), type: "button" }, [el("div", { html: svgShape(o.shape, { rotation: state.cfg.rotation ? Math.floor(Math.random() * 170) - 85 : 0, customPoints: o.customPoints, size: 118 }) })])))
            : el("div", { class: "shapeStage", html: svgShape(c.shape, { rotation: c.rotation, nearMiss: near && (c.shape === "square" || c.shape === "rectangle"), customPoints: c.customPoints }) }),
          c.mode === "near_miss" ? el("div", { class: "sub", text: "שימו לב: לפעמים צורה כמעט נכונה אבל לא בדיוק." }) : null,
          c.mode === "odd_one_out" ? el("div", { class: "sub", text: "שלוש צורות מאותה משפחה ואחת שונה. הסתכלו על תכונות, לא רק על הסיבוב 👀" }) : null,
          el(
            "div",
            { class: "choices" },
            (
              ["definition_to_shape", "name_to_shape", "odd_one_out"].includes(c.mode)
                ? []
                : c.mode === "property_detect"
                ? [{ k: "parallel1", t: "זוג אחד" }, { k: "parallel2", t: "שני זוגות" }]
                : c.mode === "near_miss"
                  ? [{ k: "yes", t: "כן, תקינה" }, { k: "no", t: "לא, יש בעיה" }]
                  : c.mode === "shape_to_definition" || c.mode === "name_to_definition"
                    ? shuffle(DEFINITION_GAME_SHAPES).slice(0, 4).map((s) => ({ k: s, t: DEFINITIONS[s] }))
                    : c.mode === "definition_to_name" || c.mode === "shape_to_name"
                      ? shuffle(DEFINITION_GAME_SHAPES).slice(0, 4).map((s) => ({ k: s, t: shapeLabel(s) }))
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
