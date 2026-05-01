import { EnglishLettersGame } from "./letters/game.js";
import { EnglishCaseTypingGame } from "./caseTyping/game.js";

export const EnglishGames = {
  letters: EnglishLettersGame,
  case_typing: EnglishCaseTypingGame,
};

export function listEnglishGamesNewestFirst() {
  return Object.entries(EnglishGames)
    .map(([id, game]) => ({ id, game }))
    .sort((a, b) => (b.game.createdAt || 0) - (a.game.createdAt || 0));
}

