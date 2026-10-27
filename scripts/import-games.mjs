import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dedupeByConcept, mergeExisting, reuseEnrichment } from './lib/transform.mjs';
import { applyEnrichment, fetchConcept, guardShrink } from './lib/enrich.mjs';

const UPSTREAM = 'https://raw.githubusercontent.com/andshrew/PlayStation-Titles/main/Json';
// PS5 first: its enrichment is reused by PS4 games in the same concept, and it gets the
// enrichment budget before PS4 does.
const PLATFORMS = [
  { name: 'PS5', source: `${UPSTREAM}/PS5_Titles.json`, file: 'games.json' },
  { name: 'PS4', source: `${UPSTREAM}/PS4_Titles.json`, file: 'ps4-games.json' },
];
const DATA_DIR = new URL('../src/data/', import.meta.url);
const THROTTLE_MS = 600;

const args = process.argv.slice(2);
const force = args.includes('--force');
const enrichIdx = args.indexOf('--enrich');
const enrichCount = enrichIdx === -1 ? 0 : Number(args[enrichIdx + 1] ?? 0);
const onlyIdx = args.indexOf('--only');
const only = onlyIdx === -1 ? null : (args[onlyIdx + 1] ?? '').split(',').filter(Boolean);

const lists = [];
for (const platform of PLATFORMS) {
  const res = await fetch(platform.source);
  if (!res.ok) throw new Error(`${platform.name} source fetch failed: HTTP ${res.status}`);
  const rows = await res.json();
  console.log(`${platform.name} source rows: ${rows.length}`);

  const fresh = dedupeByConcept(rows);
  const out = new URL(platform.file, DATA_DIR);
  const existing = JSON.parse(await readFile(out, 'utf8').catch(() => '[]'));
  guardShrink(fresh.length, existing.length, force);
  lists.push({ ...platform, out, games: mergeExisting(fresh, existing) });
}
const [ps5, ps4] = lists;
ps4.games = reuseEnrichment(ps4.games, ps5.games);

// One store lookup per concept fills every pending game in it, on either console.
const allGames = lists.flatMap((l) => l.games);
const pending = allGames.filter((g) => !g.enriched);
const pendingConcepts = [...new Set(
  (only ? pending.filter((g) => g.allTitleIds.some((t) => only.includes(t))) : pending).map(
    (g) => g.conceptId,
  ),
)];
const todo = only ? pendingConcepts : pendingConcepts.slice(0, enrichCount);
let done = 0;
for (const conceptId of todo) {
  try {
    const concept = await fetchConcept(conceptId);
    for (const list of lists) {
      list.games = list.games.map((g) =>
        g.conceptId === conceptId && !g.enriched ? applyEnrichment(g, concept) : g,
      );
    }
    done++;
  } catch (err) {
    console.error(`enrich concept ${conceptId} failed: ${err.message}`);
    if (String(err).includes('hash rejected')) break;
  }
  await new Promise((r) => setTimeout(r, THROTTLE_MS));
  if (done % 25 === 0 && done > 0) console.log(`enriched ${done}/${todo.length}`);
}

await mkdir(DATA_DIR, { recursive: true });
for (const list of lists) {
  await writeFile(list.out, JSON.stringify(list.games, null, 1) + '\n');
  const enrichedTotal = list.games.filter((g) => g.enriched).length;
  console.log(
    `wrote ${list.games.length} ${list.name} games (${enrichedTotal} enriched, ${list.games.length - enrichedTotal} pending) to src/data/${list.file}`,
  );
}
