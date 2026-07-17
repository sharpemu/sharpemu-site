import { describe, it, expect } from 'vitest';
import { applyEnrichment, guardShrink } from './enrich.mjs';

const game = { conceptId: 10000176, titleId: 'PPSA01284', allTitleIds: ['PPSA01284'], name: 'RETURNAL_STORE', region: 'UP' };

describe('applyEnrichment', () => {
  it('extracts cover, canonical name, publisher, date, genres', () => {
    const concept = {
      name: 'Returnal', invariantName: 'Returnal', publisherName: 'Sony Interactive Entertainment',
      releaseDate: { value: '2021-04-29T23:00:00Z' },
      media: [
        { role: 'MASTER', url: 'https://img/master.jpg' },
        { role: 'GAMEHUB_COVER_ART', url: 'https://img/cover.jpg' },
      ],
      combinedLocalizedGenres: [{ value: 'Third Person Shooter' }],
    };
    const g = applyEnrichment(game, concept);
    expect(g.cover).toBe('https://img/cover.jpg');
    expect(g.name).toBe('Returnal');
    expect(g.publisher).toBe('Sony Interactive Entertainment');
    expect(g.releaseDate).toBe('2021-04-29T23:00:00Z');
    expect(g.genres).toEqual(['Third Person Shooter']);
    expect(g.enriched).toBe(true);
  });
  it('falls back to MASTER when no GAMEHUB_COVER_ART', () => {
    const g = applyEnrichment(game, { media: [{ role: 'MASTER', url: 'https://img/m.jpg' }] });
    expect(g.cover).toBe('https://img/m.jpg');
  });
  it('marks null concepts as noStore', () => {
    const g = applyEnrichment(game, null);
    expect(g.noStore).toBe(true);
    expect(g.enriched).toBe(true);
    expect(g.name).toBe('RETURNAL_STORE');
  });
});

describe('guardShrink', () => {
  it('throws when fresh list shrinks >5%', () =>
    expect(() => guardShrink(89, 100, false)).toThrow(/shrank/));
  it('passes small shrink', () => expect(() => guardShrink(96, 100, false)).not.toThrow());
  it('passes empty existing', () => expect(() => guardShrink(50, 0, false)).not.toThrow());
  it('respects --force', () => expect(() => guardShrink(1, 100, true)).not.toThrow());
});
