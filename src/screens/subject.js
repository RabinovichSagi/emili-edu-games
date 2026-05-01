import { el } from "../ui/dom.js";
import { listEnglishGamesNewestFirst } from "../subjects/english/registry.js";

export function renderSubject({ mount, router, screen }) {
  if (screen.subject !== "english") {
    mount.append(el("div", { text: "נושא לא נמצא 😵" }));
    return;
  }

  const cards = listEnglishGamesNewestFirst().map(({ id, game }) =>
    el(
      "div",
      {
        class: "card",
        style: "cursor:pointer; width:100%;",
        onClick: () => router.push({ subject: "english", game: id }),
        role: "button",
        tabindex: "0",
      },
      [
        el("div", { class: "itemRow" }, [
          el("div", {}, [
            el("div", { class: "title", text: game.titleHe }),
            el("div", { class: "sub", text: game.subtitleHe || "בואו נתרגל 🙂" }),
          ]),
        ]),
      ]
    )
  );

  mount.append(
    el("div", { class: "list" }, [
      el("div", { class: "itemRow" }, [
        el("div", {}, [
          el("div", { class: "title", text: "אנגלית" }),
          el("div", { class: "sub", text: "בחרו משחק ונתחיל 🎯" }),
        ]),
        el("button", { class: "btn secondary", onClick: () => router.push({ screen: "home" }) }, ["חזרה"]),
      ]),
      ...cards,
    ])
  );
}
