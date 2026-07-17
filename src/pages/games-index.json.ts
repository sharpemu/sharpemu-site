import { getCollection } from 'astro:content';
import { games, gameByAnyTitleId } from '../lib/games';

export async function GET() {
  const compat = await getCollection('compat');
  // Runs at build time: a bad report must fail the build, not 404 silently.
  for (const e of compat) {
    if (!gameByAnyTitleId.has(e.data.titleId)) {
      throw new Error(`compat report ${e.id}: unknown titleId ${e.data.titleId}`);
    }
    // glob loader lowercases entry ids, so compare case-insensitively
    if (e.id.toUpperCase() !== e.data.titleId) {
      throw new Error(`compat report ${e.id}.md: filename must equal titleId (${e.data.titleId})`);
    }
  }
  const statusByConcept = new Map<number, string>();
  for (const e of compat) {
    const g = gameByAnyTitleId.get(e.data.titleId)!;
    statusByConcept.set(g.conceptId, e.data.status);
  }
  const index = games.map((g) => ({
    t: g.titleId,
    a: g.allTitleIds.join(' '),
    n: g.name,
    s: statusByConcept.get(g.conceptId) ?? 'untested',
  }));
  return new Response(JSON.stringify(index), {
    headers: { 'content-type': 'application/json' },
  });
}
