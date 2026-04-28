import { createStore } from "./core/store.js";
import { renderApp } from "./ui/appShell.js";
import { createRouter } from "./core/router.js";
import { Screens } from "./screens/index.js";

const store = createStore();
const router = createRouter();

function resolveScreen(route) {
  if (route.screen === "reports") return { name: "reports" };
  if (route.subject && route.game) return { name: "game", subject: route.subject, game: route.game };
  return { name: "home" };
}

function onRouteChange() {
  const route = router.read();
  const screen = resolveScreen(route);
  renderApp({ root: document.getElementById("app"), store, router, screen });
}

router.onChange(onRouteChange);
onRouteChange();

