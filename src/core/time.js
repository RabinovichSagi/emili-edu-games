export function nowMs() {
  return Date.now();
}

export function formatDateTime(ms) {
  if (!ms) return "—";
  const d = new Date(ms);
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}ש׳`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}ד׳ ${r}ש׳`;
}

