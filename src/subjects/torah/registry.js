import { TorahPictureSequenceGame } from "./pictureSequence/game.js";

export const TorahGames = {
  picture_sequence: TorahPictureSequenceGame,
};

export function listTorahGamesNewestFirst() {
  return Object.entries(TorahGames)
    .map(([id, game]) => ({ id, game }))
    .sort((a, b) => (b.game.createdAt || 0) - (a.game.createdAt || 0));
}
