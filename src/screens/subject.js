import { el } from "../ui/dom.js";

export function renderSubject({ mount, router, screen }) {
  if (screen.subject !== "english") {
    mount.append(el("div", { text: "נושא לא נמצא 😵" }));
    return;
  }

  const card = el("div", {
    class: "card",
    style: "cursor:pointer; width:100%;",
    onClick: () => router.push({ subject: "english", game: "letters" }),
    role: "button",
    tabindex: "0",
  }, [
    el("div", { class: "itemRow" }, [
      el("div", {}, [
        el("div", { class: "title", text: "אותיות באנגלית" }),
        el("div", { class: "sub", text: "זיהוי אותיות, התאמת גדולות/קטנות, וצלילים 🔊" }),
      ]),
    ]),
  ]);

  mount.append(
    el("div", { class: "list" }, [
      el("div", { class: "itemRow" }, [
        el("div", {}, [
          el("div", { class: "title", text: "אנגלית" }),
          el("div", { class: "sub", text: "בחרו משחק ונתחיל 🎯" }),
        ]),
        el("button", { class: "btn secondary", onClick: () => router.push({ screen: "home" }) }, ["חזרה"]),
      ]),
      card,
    ])
  );
}
