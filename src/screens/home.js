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
        el("div", { class: "card", style: "cursor:pointer;", onClick: () => router.push({ subject: "english" }), role: "button", tabindex: "0" }, [
          el("div", { class: "itemRow" }, [
            el("div", {}, [
              el("div", { class: "title", text: "אנגלית" }),
              el("div", { class: "sub", text: "אותיות, קריאה, ועוד" }),
            ]),
          ]),
        ]),
      ]),
    ])
  );
}
