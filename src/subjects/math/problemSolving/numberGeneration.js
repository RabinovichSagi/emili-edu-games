import { PATTERN_BY_ID } from "./patterns.js";

const DIFFICULTY = {
  easy: { addMax: 50, addMin: 4, multMax: 5, twoStepMax: 60 },
  normal: { addMax: 120, addMin: 6, multMax: 10, twoStepMax: 120 },
  challenge: { addMax: 1000, addMin: 20, multMax: 10, twoStepMax: 240 },
};

export function difficultyOptions() {
  return Object.keys(DIFFICULTY);
}

export function generateProblemFromTemplate(template, difficulty = "normal", random = Math.random) {
  const limits = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  let vars;
  for (let i = 0; i < 80; i++) {
    vars = generateVars(template.patternId, limits, random);
    const validation = validateVars(template.patternId, vars, limits);
    if (validation.ok) {
      return {
        templateId: template.id,
        patternId: template.patternId,
        patternTitleHe: PATTERN_BY_ID[template.patternId]?.titleHe || template.patternId,
        text: fillTemplate(template.text, vars),
        answer: vars.answer,
        vars,
        hintHe: template.hintHe || makeHint(template.patternId),
      };
    }
  }
  throw new Error(`Could not generate valid problem for ${template.patternId}`);
}

export function fillTemplate(text, vars) {
  return text.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

export function validateVars(patternId, v, limits = DIFFICULTY.normal) {
  const wholeOk = Number.isInteger(v.answer) && v.answer >= 0;
  if (!wholeOk) return { ok: false, reason: "answer must be a non-negative whole number" };
  if (["multiplication_equal_groups", "arrays_rectangles", "multiplicative_comparison"].includes(patternId)) {
    return { ok: v.groups <= limits.multMax && v.size <= limits.multMax, reason: "basic multiplication facts only" };
  }
  if (["division_sharing", "division_group_count", "two_step_divide_add", "two_step_add_divide"].includes(patternId)) {
    return { ok: v.total % (v.groups || v.size) === 0, reason: "division must be exact" };
  }
  if (patternId === "division_remainders") {
    return { ok: v.remainder > 0 && v.remainder < v.size, reason: "must have meaningful remainder" };
  }
  if (patternId === "sufficiency") {
    return { ok: v.answer === 0 || v.answer === 1, reason: "sufficiency answer is 1=yes, 0=no" };
  }
  return { ok: true, reason: "ok" };
}

function generateVars(patternId, l, random) {
  switch (patternId) {
    case "addition_combining": return additionVars(l, random);
    case "subtraction_take_away": return subtractionVars(l, random);
    case "missing_part": return missingPartVars(l, random);
    case "comparison": return comparisonVars(l, random);
    case "multiplication_equal_groups": return multiplicationVars(l, random);
    case "arrays_rectangles": return arrayVars(l, random);
    case "division_sharing": return divisionSharingVars(l, random);
    case "division_group_count": return divisionGroupCountVars(l, random);
    case "multiplicative_comparison": return multiplicativeComparisonVars(l, random);
    case "two_step_add_subtract": return addSubtractVars(l, random);
    case "two_step_multiply_add": return multiplyAddVars(l, random);
    case "two_step_multiply_subtract": return multiplySubtractVars(l, random);
    case "two_step_divide_add": return divideAddVars(l, random);
    case "two_step_add_divide": return addDivideVars(l, random);
    case "combined_multiplication": return combinedMultiplicationVars(l, random);
    case "division_remainders": return remaindersVars(l, random);
    case "sufficiency": return sufficiencyVars(l, random);
    case "hidden_operation": return multiplicationVars(l, random);
    case "irrelevant_information": return irrelevantVars(l, random);
    case "open_operation_selection": return divisionGroupCountVars(l, random);
    default: return additionVars(l, random);
  }
}

function int(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function additionVars(l, random) {
  const a = int(random, l.addMin, Math.floor(l.addMax * 0.55));
  const b = int(random, 2, l.addMax - a);
  return { a, b, answer: a + b };
}

function subtractionVars(l, random) {
  const whole = int(random, l.addMin + 5, l.addMax);
  const part = int(random, 1, whole - 1);
  return { whole, part, answer: whole - part };
}

function missingPartVars(l, random) {
  const whole = int(random, l.addMin + 4, l.addMax);
  const known = int(random, 1, whole - 1);
  return { whole, known, answer: whole - known };
}

function comparisonVars(l, random) {
  const small = int(random, 2, Math.floor(l.addMax * 0.7));
  const diff = int(random, 1, Math.min(60, l.addMax - small));
  return { small, large: small + diff, answer: diff };
}

function multiplicationVars(l, random) {
  const groups = int(random, 2, l.multMax);
  const size = int(random, 2, l.multMax);
  return { groups, size, answer: groups * size };
}

function arrayVars(l, random) {
  const rows = int(random, 2, l.multMax);
  const columns = int(random, 2, l.multMax);
  return { rows, columns, groups: rows, size: columns, answer: rows * columns };
}

function divisionSharingVars(l, random) {
  const groups = int(random, 2, l.multMax);
  const each = int(random, 2, l.multMax);
  return { groups, each, total: groups * each, answer: each };
}

function divisionGroupCountVars(l, random) {
  const size = int(random, 2, l.multMax);
  const groups = int(random, 2, l.multMax);
  return { size, groups, total: size * groups, answer: groups };
}

function multiplicativeComparisonVars(l, random) {
  const base = int(random, 2, l.multMax);
  const multiplier = int(random, 2, l.multMax);
  return { base, multiplier, groups: multiplier, size: base, answer: base * multiplier };
}

function addSubtractVars(l, random) {
  const start = int(random, 5, Math.floor(l.twoStepMax * 0.45));
  const increase = int(random, 2, Math.floor(l.twoStepMax * 0.35));
  const decrease = int(random, 1, start + increase - 1);
  return { start, increase, decrease, answer: start + increase - decrease };
}

function multiplyAddVars(l, random) {
  const base = multiplicationVars(l, random);
  const extra = int(random, 1, Math.min(30, l.twoStepMax - base.answer));
  return { ...base, extra, answer: base.answer + extra };
}

function multiplySubtractVars(l, random) {
  const base = multiplicationVars(l, random);
  const removed = int(random, 1, base.answer - 1);
  return { ...base, removed, answer: base.answer - removed };
}

function divideAddVars(l, random) {
  const base = divisionSharingVars(l, random);
  const extra = int(random, 1, Math.min(12, l.multMax));
  return { ...base, extra, answer: base.answer + extra };
}

function addDivideVars(l, random) {
  const groups = int(random, 2, l.multMax);
  const firstShare = int(random, 1, l.multMax);
  const secondShare = int(random, 1, l.multMax);
  return { groups, a: groups * firstShare, b: groups * secondShare, answer: firstShare + secondShare, total: groups * (firstShare + secondShare) };
}

function combinedMultiplicationVars(l, random) {
  const groups = int(random, 2, l.multMax);
  const size = int(random, 2, l.multMax);
  const groups2 = int(random, 1, l.multMax);
  const size2 = int(random, 2, l.multMax);
  return { groups, size, groups2, size2, answer: groups * size + groups2 * size2 };
}

function remaindersVars(l, random) {
  const size = int(random, 3, l.multMax);
  const fullGroups = int(random, 2, l.multMax);
  const remainder = int(random, 1, size - 1);
  const total = size * fullGroups + remainder;
  return { size, fullGroups, remainder, total, answer: fullGroups + 1 };
}

function sufficiencyVars(l, random) {
  const need = int(random, 8, Math.min(l.addMax, 120));
  const have = int(random, 1, need - 1);
  const extra = int(random, 1, Math.min(50, need));
  const total = have + extra;
  return { need, have, extra, total, answer: total >= need ? 1 : 0 };
}

function irrelevantVars(l, random) {
  const known = int(random, 2, Math.floor(l.addMax * 0.5));
  const answer = int(random, 1, Math.floor(l.addMax * 0.4));
  const whole = known + answer;
  const irrelevant = int(random, 1, 30);
  return { whole, known, irrelevant, answer };
}

function makeHint(patternId) {
  const hints = {
    addition_combining: "מחפשים כמה יש ביחד.",
    subtraction_take_away: "מתחילים מהכמות שהייתה ומורידים מה שנלקח.",
    missing_part: "יודעים את השלם וחלק אחד, לכן מחפשים את החלק החסר.",
    comparison: "משווים בין שתי כמויות ומחפשים את ההפרש.",
    multiplication_equal_groups: "יש קבוצות שוות, אז אפשר לכפול.",
    arrays_rectangles: "שורות וטורים יוצרים מלבן כפל.",
    division_sharing: "מחלקים שווה בשווה ומחפשים כמה בכל קבוצה.",
    division_group_count: "יודעים כמה בכל קבוצה ומחפשים כמה קבוצות נוצרות.",
    division_remainders: "אם נשארים פריטים, לפעמים צריך עוד קבוצה אחת.",
    sufficiency: "בודקים כמה יש בסך הכול ומשווים למה שצריך.",
  };
  return hints[patternId] || "קראו לאט: מה יודעים, ומה מבקשים למצוא?";
}
