import { clear, el } from "./dom.js";
import { Screens } from "../screens/index.js";

export function renderApp({ root, store, router, screen }) {
  clear(root);

  const topbar = el("div", { class: "topbar" }, [
    el("div", { class: "brand" }, [
      el("h1", { text: "אוצרות" }),
    ]),
    el("div", { class: "row" }, [
      el(
        "button",
        {
          class: "btn secondary",
          onClick: () => router.push({ screen: "home" }),
          title: "בית",
        },
        ["בית"]
      ),
      el(
        "button",
        {
          class: "btn secondary",
          onClick: () => router.push({ screen: "reports" }),
          title: "דוח",
        },
        ["דוח"]
      ),
    ]),
  ]);

  const content = el("div", { class: "card" });
  const footer = el("div", { class: "pill", style: "justify-content:space-between; width:100%" }, [
    el("span", { text: "Otsarot dev" }),
    el("span", { class: "ltr", dir: "ltr", text: `screen=${screen.name}` }),
  ]);
  root.append(topbar, content, footer);

  const render = Screens[screen.name];
  if (!render) {
    content.append(el("div", { text: "מסך לא נמצא 😵" }));
    return;
  }
  render({ mount: content, store, router, screen });
}
