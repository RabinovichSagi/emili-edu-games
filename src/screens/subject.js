import { el } from "../ui/dom.js";
import { listEnglishGamesNewestFirst } from "../subjects/english/registry.js";
import { listMathGamesNewestFirst } from "../subjects/math/registry.js";

export function renderSubject({ mount, router, screen }) {
  const subjects = {
    english: { title: "אנגלית", games: listEnglishGamesNewestFirst() },
    math: { title: "חשבון", games: listMathGamesNewestFirst() },
  };
  const subject = subjects[screen.subject];
  if (!subject) {
    mount.append(el("div", { text: "נושא לא נמצא 😵" }));
    return;
  }

  const cards = subject.games.map(({ id, game }) =>
    el(
      "div",
      {
        class: "card",
        style: "cursor:pointer; width:100%;",
        onClick: () => router.push({ subject: screen.subject, game: id }),
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
          el("div", { class: "title", text: subject.title }),
          el("div", { class: "sub", text: "בחרו משחק ונתחיל 🎯" }),
        ]),
        el("button", { class: "btn secondary", onClick: () => router.push({ screen: "home" }) }, ["חזרה"]),
      ]),
      ...cards,
    ])
  );
}
