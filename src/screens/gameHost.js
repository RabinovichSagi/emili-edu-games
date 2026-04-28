import { el } from "../ui/dom.js";
import { EnglishLettersGame } from "../subjects/english/letters/game.js";

const registry = {
  english: {
    letters: EnglishLettersGame,
  },
};

export function renderGame({ mount, store, router, screen }) {
  const subject = registry[screen.subject];
  const game = subject && subject[screen.game];
  if (!game) {
    mount.append(
      el("div", { class: "list" }, [
        el("div", { class: "itemRow" }, [
          el("div", {}, [
            el("div", { class: "title", text: "לא מצאתי את המשחק 😵" }),
            el("div", { class: "sub", text: "נחזור לבית וננסה שוב." }),
          ]),
          el("button", { class: "btn", onClick: () => router.push({ screen: "home" }) }, ["לבית"]),
        ]),
      ])
    );
    return;
  }
  game.render({ mount, store, router });
}

