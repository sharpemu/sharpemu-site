import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dedupeByConcept, mergeExisting } from './lib/transform.mjs';
import { applyEnrichment, fetchConcept, guardShrink } from './lib/enrich.mjs';

const SOURCE = 'https://raw.githubusercontent.com/andshrew/PlayStation-Titles/main/Json/PS5_Titles.json';
const OUT = new URL('../src/data/games.json', import.meta.url);
const THROTTLE_MS = 600;

const args = process.argv.slice(2);
const force = args.includes('--force');
const enrichIdx = args.indexOf('--enrich');
const enrichCount = enrichIdx === -1 ? 0 : Number(args[enrichIdx + 1] ?? 0);
const onlyIdx = args.indexOf('--only');
const only = onlyIdx === -1 ? null : (args[onlyIdx + 1] ?? '').split(',').filter(Boolean);

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`source fetch failed: HTTP ${res.status}`);
const rows = await res.json();
console.log(`source rows: ${rows.length}`);

const fresh = dedupeByConcept(rows);
const existing = JSON.parse(await readFile(OUT, 'utf8').catch(() => '[]'));
guardShrink(fresh.length, existing.length, force);
const games = mergeExisting(fresh, existing);

const pending = games.filter((g) => !g.enriched);
const todo = only
  ? pending.filter((g) => g.allTitleIds.some((t) => only.includes(t)))
  : pending.slice(0, enrichCount);
let done = 0;
for (const game of todo) {
  try {
    const concept = await fetchConcept(game.conceptId);
    Object.assign(game, applyEnrichment(game, concept));
    done++;
  } catch (err) {
    console.error(`enrich ${game.titleId} (${game.conceptId}) failed: ${err.message}`);
    if (String(err).includes('hash rejected')) break;
  }
  await new Promise((r) => setTimeout(r, THROTTLE_MS));
  if (done % 25 === 0 && done > 0) console.log(`enriched ${done}/${todo.length}`);
}

await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(OUT, JSON.stringify(games, null, 1) + '\n');
const enrichedTotal = games.filter((g) => g.enriched).length;
console.log(
  `wrote ${games.length} games (${enrichedTotal} enriched, ${games.length - enrichedTotal} pending) to src/data/games.json`,
);
