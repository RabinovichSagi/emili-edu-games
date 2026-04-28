import { el } from "../ui/dom.js";
import { formatDateTime, formatDurationMs } from "../core/time.js";
import { isDue } from "../core/sr.js";

function pct(n) {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n)}%`;
}

export function renderReports({ mount, store, router }) {
  const profile = store.getProfile();
  const gameId = "letters";
  const gs = profile.gameStats[gameId] || null;

  // Aggregate due items for a quick overview.
  const sr = (profile.sr && profile.sr[gameId]) || {};
  const totalItems = Object.keys(sr).length;
  let dueNow = 0;
  for (const v of Object.values(sr)) if (isDue(v)) dueNow += 1;

  const accuracy = gs ? (gs.correct + gs.wrong > 0 ? (gs.correct / (gs.correct + gs.wrong)) * 100 : null) : null;

  mount.append(
    el("div", { class: "list" }, [
      el("div", { class: "itemRow" }, [
        el("div", {}, [
          el("div", { class: "title", text: "דוח התקדמות 📊" }),
          el("div", { class: "sub", text: "תמונה כללית של תרגולים וזמני חזרה" }),
        ]),
      ]),
      el("div", { class: "grid" }, [
        el("div", { class: "card" }, [
          el("div", { class: "itemRow" }, [
            el("div", {}, [
              el("div", { class: "title", text: "אותיות באנגלית" }),
              el("div", { class: "sub", text: "תרגול זיהוי אותיות ושמיעה" }),
            ]),
            el(
              "button",
              { class: "btn", onClick: () => router.push({ subject: "english", game: "letters" }) },
              ["לתרגל"]
            ),
          ]),
          el("div", { class: "row", style: "margin-top:10px" }, [
            kpi("מאסטרי", gs ? pct(gs.mastery) : "—"),
            kpi("חזרה עכשיו", totalItems ? `${dueNow}/${totalItems}` : "—"),
            kpi("דיוק", accuracy == null ? "—" : pct(accuracy)),
            kpi("זמן תגובה", gs?.avgRtMs ? formatDurationMs(gs.avgRtMs) : "—"),
            kpi("תרגול אחרון", gs?.lastPlayedAt ? formatDateTime(gs.lastPlayedAt) : "—"),
            kpi("רצף הצלחות", bestStreak(sr)),
          ]),
        ]),
      ]),
      el("div", { class: "card" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [
            el("div", { class: "title", text: "טיפ קטן 💡" }),
            el("div", {
              class: "sub",
              text: "עדיף תרגולים קצרים עם פוקוס. 2 דקות עכשיו שוות יותר מ-20 דקות עייפות 🙂",
            }),
          ]),
        ]),
      ]),
    ])
  );
}

function kpi(k, v) {
  return el("div", { class: "pill" }, [el("div", { class: "kpi" }, [el("div", { class: "k", text: k }), el("div", { class: "v", text: v })])]);
}

function bestStreak(sr) {
  const items = Object.values(sr || {});
  if (!items.length) return "—";
  let max = 0;
  for (const it of items) max = Math.max(max, it.streak || 0);
  return String(max);
}

