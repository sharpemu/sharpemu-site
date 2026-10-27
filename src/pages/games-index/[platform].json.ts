import { getCollection } from 'astro:content';
import { gamesByPlatform, gameByAnyTitleId, hasGamePage } from '../../lib/games';
import { OSES, PLATFORMS, reportEntryId, type Platform } from '../../lib/compat';

// One index per console (/games-index/ps5.json, /games-index/ps4.json), so the PS5
// list doesn't download every PS4 game.
export function getStaticPaths() {
  return PLATFORMS.map((platform) => ({ params: { platform } }));
}

export async function GET({ params }: { params: { platform: Platform } }) {
  const compat = await getCollection('compat');
  // Runs at build time: a bad report must fail the build, not 404 silently.
  const seen = new Map<string, string>();
  for (const e of compat) {
    const game = gameByAnyTitleId.get(e.data.titleId);
    if (!game) {
      throw new Error(`compat report ${e.id}: unknown titleId ${e.data.titleId}`);
    }
    if (e.id !== reportEntryId(e.data.os, e.data.titleId)) {
      throw new Error(
        `compat report ${e.id}.md: must live at ${e.data.os}/${e.data.titleId}.md (folder = os, filename = titleId)`,
      );
    }
    // Regional aliases share a game page, so two files for the same game and OS would collide.
    const key = `${e.data.os}/${game.titleId}`;
    const other = seen.get(key);
    if (other) throw new Error(`compat reports ${other} and ${e.id} cover the same game and OS`);
    seen.set(key, e.id);
  }
  // Keyed by the game's primary title ID: PS4 and PS5 versions can share a store concept.
  const statusByGame = new Map<string, string>();
  for (const e of compat) {
    const g = gameByAnyTitleId.get(e.data.titleId)!;
    statusByGame.set(`${e.data.os}/${g.titleId}`, e.data.status);
  }
  // s: one status per OS, in OSES order (windows, linux, macos); p: the game has its own page.
  const index = gamesByPlatform[params.platform].map((g) => {
    const s = OSES.map((os) => statusByGame.get(`${os}/${g.titleId}`) ?? 'untested');
    return {
      t: g.titleId,
      a: g.allTitleIds.join(' '),
      n: g.name,
      s,
      p: hasGamePage(g, s.some((x) => x !== 'untested')) ? 1 : 0,
    };
  });
  return new Response(JSON.stringify(index), {
    headers: { 'content-type': 'application/json' },
  });
}
