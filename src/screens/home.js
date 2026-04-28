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
        el("div", { class: "card" }, [
          el("div", { class: "itemRow" }, [
            el("div", {}, [
              el("div", { class: "title", text: "אנגלית" }),
              el("div", { class: "sub", text: "אותיות, קריאה, ועוד" }),
            ]),
            el(
              "button",
              {
                class: "btn",
                onClick: () => router.push({ subject: "english", game: "letters" }),
              },
              ["לשחק"]
            ),
          ]),
        ]),
      ]),
    ])
  );
}

