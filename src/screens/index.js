import { renderHome } from "./home.js";
import { renderReports } from "./reports.js";
import { renderGame } from "./gameHost.js";

export const Screens = {
  home: renderHome,
  reports: renderReports,
  game: renderGame,
};

