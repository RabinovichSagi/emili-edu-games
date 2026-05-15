import { MathDistributiveLawGame } from "./distributiveLaw/game.js";
import { MathProblemSolvingGame } from "./problemSolving/game.js";

export const MathGames = {
  distributive_law: MathDistributiveLawGame,
  problem_solving: MathProblemSolvingGame,
};

export function listMathGamesNewestFirst() {
  return Object.entries(MathGames)
    .map(([id, game]) => ({ id, game }))
    .sort((a, b) => (b.game.createdAt || 0) - (a.game.createdAt || 0));
}
