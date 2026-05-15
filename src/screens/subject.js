import { el } from "../ui/dom.js";
import { listEnglishGamesNewestFirst } from "../subjects/english/registry.js";
import { listMathGamesNewestFirst } from "../subjects/math/registry.js";

const Subjects = {
  english: {
    titleHe: "אנגלית",
    subtitleHe: "בחרו משחק ונתחיל 🎯",
    listGames: listEnglishGamesNewestFirst,
  },
  math: {
    titleHe: "חשבון",
    subtitleHe: "משחקי מספרים, צורות וחשיבה 🧮",
    listGames: listMathGamesNewestFirst,
  },
};

export function renderSubject({ mount, router, screen }) {
  const subject = Subjects[screen.subject];
  if (!subject) {
    mount.append(el("div", { text: "נושא לא נמצא 😵" }));
    return;
  }

  const cards = subject.listGames().map(({ id, game }) =>
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
          el("div", { class: "title", text: subject.titleHe }),
          el("div", { class: "sub", text: subject.subtitleHe }),
        ]),
        el("button", { class: "btn secondary", onClick: () => router.push({ screen: "home" }) }, ["חזרה"]),
      ]),
      ...cards,
    ])
  );
}
