import { nowMs } from "./time.js";

// Small, generic per-item scheduler (SM-2 inspired, simplified).
// Each mini-game owns what "itemKey" means and how to grade answers.
export function defaultSrItem() {
  return {
    reps: 0,
    intervalDays: 0,
    ease: 2.3,
    dueAt: 0,
    lastAt: 0,
    lapses: 0,
    streak: 0,
    correct: 0,
    wrong: 0,
    avgRtMs: null,
  };
}

export function updateSr(item, grade, rtMs) {
  // grade: 0..5 (0 fail, 5 perfect)
  const t = nowMs();
  const next = { ...item };
  next.lastAt = t;
  if (Number.isFinite(rtMs) && rtMs > 0) {
    if (next.avgRtMs == null) next.avgRtMs = rtMs;
    else next.avgRtMs = Math.round(next.avgRtMs * 0.8 + rtMs * 0.2);
  }

  if (grade >= 3) {
    next.correct += 1;
    next.streak += 1;
    next.reps += 1;
    // ease
    next.ease = Math.max(1.3, next.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
    // interval
    if (next.reps === 1) next.intervalDays = 1;
    else if (next.reps === 2) next.intervalDays = 3;
    else next.intervalDays = Math.max(1, Math.round(next.intervalDays * next.ease));
  } else {
    next.wrong += 1;
    next.streak = 0;
    next.lapses += 1;
    next.reps = 0;
    next.intervalDays = 0;
    next.ease = Math.max(1.3, next.ease - 0.2);
  }

  // Add small jitter so many items don't stack at the exact same time.
  const jitterMs = Math.floor(Math.random() * 30 * 60 * 1000);
  const dueMs = next.intervalDays <= 0 ? 5 * 60 * 1000 : next.intervalDays * 24 * 60 * 60 * 1000;
  next.dueAt = t + dueMs + jitterMs;
  return next;
}

export function isDue(item, t = nowMs()) {
  if (!item) return true;
  if (!item.dueAt) return true;
  return item.dueAt <= t;
}

