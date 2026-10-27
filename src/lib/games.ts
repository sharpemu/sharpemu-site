import ps5Json from '../data/games.json';
import ps4Json from '../data/ps4-games.json';
import type { Platform } from './compat';

export type Game = {
  conceptId: number;
  titleId: string;
  allTitleIds: string[];
  name: string;
  region: string;
  platform: Platform;
  cover?: string;
  publisher?: string;
  releaseDate?: string;
  genres?: string[];
  enriched?: boolean;
  noStore?: boolean;
  commentsDisabled?: boolean;
};

type GameRecord = Omit<Game, 'platform'>;

// Each console keeps its own data file; platform is added here rather than stored.
export const gamesByPlatform: Record<Platform, Game[]> = {
  ps5: (ps5Json as GameRecord[]).map((g) => ({ ...g, platform: 'ps5' })),
  ps4: (ps4Json as GameRecord[]).map((g) => ({ ...g, platform: 'ps4' })),
};

export const games: Game[] = [...gamesByPlatform.ps5, ...gamesByPlatform.ps4];

// Primary title ID → game (page routes use the primary ID). PPSA and CUSA ids never
// collide, so one map covers both consoles.
export const gameByTitleId = new Map(games.map((g) => [g.titleId, g]));

// Any regional title ID → game. Compat reports may reference any regional
// release (e.g. PPSA10112 is an alias of primary PPSA04877).
export const gameByAnyTitleId = new Map(
  games.flatMap((g) => g.allTitleIds.map((id) => [id, g] as const)),
);
