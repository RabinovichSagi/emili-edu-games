import { MathDistributiveLawGame } from "./distributiveLaw/game.js";

export const MathGames = {
  distributive_law: MathDistributiveLawGame,
};

export function listMathGamesNewestFirst() {
  return Object.entries(MathGames)
    .map(([id, game]) => ({ id, game }))
    .sort((a, b) => (b.game.createdAt || 0) - (a.game.createdAt || 0));
}
