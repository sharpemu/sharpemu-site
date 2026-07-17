const PSN_HASH = 'cc90404ac049d935afbd9968aef523da2b6723abfb9d586e5f77ebf7c5289006';

export function applyEnrichment(game, concept) {
  if (!concept) return { ...game, enriched: true, noStore: true };
  const media = concept.media ?? [];
  const cover =
    media.find((m) => m.role === 'GAMEHUB_COVER_ART')?.url ??
    media.find((m) => m.role === 'MASTER')?.url;
  return {
    ...game,
    name: concept.invariantName || concept.name || game.name,
    cover,
    publisher: concept.publisherName ?? undefined,
    releaseDate: concept.releaseDate?.value ?? undefined,
    genres: (concept.combinedLocalizedGenres ?? []).map((g) => g.value),
    enriched: true,
  };
}

export function guardShrink(freshLen, existingLen, force) {
  if (force || existingLen === 0) return;
  if (freshLen < existingLen * 0.95) {
    throw new Error(
      `games list shrank ${existingLen} → ${freshLen}; upstream truncation? Re-run with --force to accept.`,
    );
  }
}

export async function fetchConcept(conceptId, { retries = 2 } = {}) {
  const variables = encodeURIComponent(JSON.stringify({ conceptId: String(conceptId) }));
  const extensions = encodeURIComponent(
    JSON.stringify({ persistedQuery: { version: 1, sha256Hash: PSN_HASH } }),
  );
  const url = `https://web.np.playstation.com/api/graphql/v1/op?operationName=metGetConceptById&variables=${variables}&extensions=${extensions}`;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'content-type': 'application/json' } });
      if (res.status === 400) {
        throw new Error(
          'PSN persisted-query hash rejected (HTTP 400). Refresh PSN_HASH from the live store — see README "Refreshing the PSN query hash".',
        );
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return body.data?.conceptRetrieve ?? null;
    } catch (err) {
      if (attempt >= retries || String(err).includes('hash rejected')) throw err;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}
