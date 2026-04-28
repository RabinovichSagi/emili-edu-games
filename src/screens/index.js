import { renderHome } from "./home.js";
import { renderReports } from "./reports.js";
import { renderGame } from "./gameHost.js";
import { renderSubject } from "./subject.js";

export const Screens = {
  home: renderHome,
  reports: renderReports,
  subject: renderSubject,
  game: renderGame,
};
