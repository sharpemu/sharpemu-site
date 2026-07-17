import { describe, it, expect } from 'vitest';
import { compatSchema, computeStats, STATUS_META, STATUSES } from './compat';

const valid = {
  titleId: 'PPSA03061',
  status: 'ingame',
  testedVersion: 'dev',
  testedDate: '2026-07-17',
  gameVersion: '1.004',
  os: 'macos',
};

describe('compatSchema', () => {
  it('accepts a valid report', () => {
    const r = compatSchema.parse(valid);
    expect(r.testedDate instanceof Date).toBe(true);
  });
  it('rejects unknown status', () =>
    expect(() => compatSchema.parse({ ...valid, status: 'perfect' })).toThrow());
  it('rejects malformed titleId', () =>
    expect(() => compatSchema.parse({ ...valid, titleId: 'CUSA00001' })).toThrow());
  it('rejects score out of range', () =>
    expect(() => compatSchema.parse({ ...valid, score: 6 })).toThrow());
});

describe('computeStats', () => {
  it('counts statuses', () => {
    const s = computeStats(['ingame', 'ingame', 'boots']);
    expect(s.tested).toBe(3);
    expect(s.counts.ingame).toBe(2);
    expect(s.counts.playable).toBe(0);
  });
});

describe('STATUS_META', () => {
  it('covers every status plus untested', () => {
    for (const s of [...STATUSES, 'untested'] as const) {
      expect(STATUS_META[s].label).toBeTruthy();
      expect(STATUS_META[s].badgeClass).toBeTruthy();
    }
  });
});
