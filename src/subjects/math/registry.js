import { MathWordProblemsGame } from "./wordProblems/game.js";

export const MathGames = {
  word_problems: MathWordProblemsGame,
};

export function listMathGamesNewestFirst() {
  return Object.entries(MathGames)
    .map(([id, game]) => ({ id, game }))
    .sort((a, b) => (b.game.createdAt || 0) - (a.game.createdAt || 0));
}
