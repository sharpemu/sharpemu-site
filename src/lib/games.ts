import gamesJson from '../data/games.json';

export type Game = {
  conceptId: number;
  titleId: string;
  allTitleIds: string[];
  name: string;
  region: string;
  cover?: string;
  publisher?: string;
  releaseDate?: string;
  genres?: string[];
  enriched?: boolean;
  noStore?: boolean;
};

export const games = gamesJson as Game[];

// Primary title ID → game (page routes use the primary ID).
export const gameByTitleId = new Map(games.map((g) => [g.titleId, g]));

// Any regional title ID → game. Compat reports may reference any regional
// release (e.g. PPSA10112 is an alias of primary PPSA04877).
export const gameByAnyTitleId = new Map(
  games.flatMap((g) => g.allTitleIds.map((id) => [id, g] as const)),
);
