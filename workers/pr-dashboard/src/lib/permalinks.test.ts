import { describe, expect, it } from 'vitest';
import { buildResultHash, parseResultHash } from './permalinks';

describe('PR dashboard permalinks', () => {
  it('keeps legacy pull request hashes valid', () => {
    expect(parseResultHash('#pr-315')).toEqual({
      prNumber: 315,
      gameId: null,
    });
  });

  it('addresses one game result within a pull request', () => {
    const hash = buildResultHash(283, 'dead-cells');

    expect(hash).toBe('#pr-283/game-dead-cells');
    expect(parseResultHash(hash)).toEqual({
      prNumber: 283,
      gameId: 'dead-cells',
    });
  });

  it('rejects malformed or unsafe pull request hashes', () => {
    expect(parseResultHash('#pr-zero')).toBeNull();
    expect(parseResultHash('#pr-0')).toBeNull();
    expect(parseResultHash('#recordings')).toBeNull();
    expect(() => buildResultHash(-1, 'dead-cells')).toThrow(TypeError);
  });
});
