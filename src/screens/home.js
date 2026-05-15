import { el } from "../ui/dom.js";

export function renderHome({ mount, router }) {
  mount.append(
    el("div", { class: "list" }, [
      el("div", { class: "itemRow" }, [
        el("div", {}, [
          el("div", { class: "title", text: "נושאים" }),
          el("div", { class: "sub", text: "בחרו נושא ונתחיל לתרגל 🧠" }),
        ]),
      ]),
      el("div", { class: "grid" }, [
        subjectCard({
          title: "אנגלית",
          subtitle: "אותיות, קריאה, ועוד",
          emoji: "🔤",
          onClick: () => router.push({ subject: "english" }),
        }),
        subjectCard({
          title: "חשבון",
          subtitle: "כפל, פירוק מספרים, ועוד",
          emoji: "🧮",
          onClick: () => router.push({ subject: "math" }),
        }),
      ]),
    ])
  );
}

function subjectCard({ title, subtitle, emoji, onClick }) {
  return el("div", { class: "card", style: "cursor:pointer;", onClick, role: "button", tabindex: "0" }, [
    el("div", { class: "itemRow" }, [
      el("div", {}, [
        el("div", { class: "title", text: `${emoji} ${title}` }),
        el("div", { class: "sub", text: subtitle }),
      ]),
    ]),
  ]);
}
