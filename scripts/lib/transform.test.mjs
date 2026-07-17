import { describe, it, expect } from 'vitest';
import { stripSuffix, isJunk, regionRank, dedupeByConcept, mergeExisting } from './transform.mjs';

const returnalUS = { titleId: 'PPSA01284_00', conceptId: 10000176, name: 'Returnal', contentId: 'UP9000-PPSA01284_00-RETURNAL00000000', region: 'UP', publisherId: 'UP9000' };
const returnalEU = { titleId: 'PPSA01285_00', conceptId: 10000176, name: 'Returnal', contentId: 'EP9000-PPSA01285_00-RETURNAL00000000', region: 'EP', publisherId: 'EP9000' };
const junkRow = { titleId: 'PPSA01007_00', conceptId: 10000033, name: 'PS5 Ryders of Wild Swans Original (Prod) Entitlement', contentId: 'UP8850-PPSA01007_00-TEST0000000000GD', region: 'UP', publisherId: 'UP8850' };

describe('stripSuffix', () => {
  it('strips _00', () => expect(stripSuffix('PPSA01284_00')).toBe('PPSA01284'));
  it('leaves bare ids alone', () => expect(stripSuffix('PPSA01284')).toBe('PPSA01284'));
});

describe('isJunk', () => {
  it('flags entitlement rows', () => expect(isJunk(junkRow)).toBe(true));
  it('flags (Test)/(Dev)/(QA) rows', () =>
    expect(isJunk({ name: 'Some Game (Test)' })).toBe(true));
  it('flags empty names', () => expect(isJunk({ name: '  ' })).toBe(true));
  it('keeps real games', () => expect(isJunk(returnalUS)).toBe(false));
});

describe('regionRank', () => {
  it('orders UP < EP < JP < other', () => {
    expect(regionRank('UP')).toBeLessThan(regionRank('EP'));
    expect(regionRank('EP')).toBeLessThan(regionRank('JP'));
    expect(regionRank('JP')).toBeLessThan(regionRank('IP'));
  });
});

describe('dedupeByConcept', () => {
  it('collapses regional rows into one game keyed by concept, preferring UP', () => {
    const games = dedupeByConcept([returnalEU, returnalUS, junkRow]);
    expect(games).toHaveLength(1);
    const g = games[0];
    expect(g.conceptId).toBe(10000176);
    expect(g.titleId).toBe('PPSA01284');
    expect(g.region).toBe('UP');
    expect(g.allTitleIds).toEqual(['PPSA01284', 'PPSA01285']);
    expect(g.name).toBe('Returnal');
  });
});

describe('mergeExisting', () => {
  const fresh = [{ conceptId: 10000176, titleId: 'PPSA01284', allTitleIds: ['PPSA01284'], name: 'Returnal', region: 'UP' }];
  it('preserves enrichment from enriched existing entries', () => {
    const existing = [{ ...fresh[0], name: 'Returnal', cover: 'https://x/y.jpg', publisher: 'SIE', enriched: true }];
    const merged = mergeExisting(fresh, existing);
    expect(merged[0].cover).toBe('https://x/y.jpg');
    expect(merged[0].enriched).toBe(true);
  });
  it('does not copy from non-enriched entries', () => {
    const merged = mergeExisting(fresh, [{ ...fresh[0] }]);
    expect(merged[0].enriched).toBeUndefined();
  });
});
