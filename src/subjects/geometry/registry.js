import { GeometryShapeDetectiveGame } from "./shapeDetective/game.js";

export const GeometryGames = {
  shape_detective: GeometryShapeDetectiveGame,
};

export function listGeometryGamesNewestFirst() {
  return Object.entries(GeometryGames)
    .map(([id, game]) => ({ id, game }))
    .sort((a, b) => (b.game.createdAt || 0) - (a.game.createdAt || 0));
}
