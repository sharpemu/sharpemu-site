export interface DashboardPermalink {
  prNumber: number;
  gameId: string | null;
}

const PERMALINK_PATTERN = /^#pr-(\d+)(?:\/game-([^/?#]+))?$/;

export function buildResultHash(prNumber: number, gameId?: string | null): string {
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
    throw new TypeError('Pull request numbers must be positive integers.');
  }

  return gameId
    ? `#pr-${prNumber}/game-${encodeURIComponent(gameId)}`
    : `#pr-${prNumber}`;
}

export function parseResultHash(hash: string): DashboardPermalink | null {
  const match = PERMALINK_PATTERN.exec(hash);
  if (!match) return null;

  const prNumber = Number(match[1]);
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) return null;

  try {
    const gameId = match[2] ? decodeURIComponent(match[2]) : null;
    return gameId ? { prNumber, gameId } : { prNumber, gameId: null };
  } catch {
    return null;
  }
}
