const REGION_RANK = { UP: 0, EP: 1, JP: 2 };
export function regionRank(region) {
  return REGION_RANK[region] ?? 3;
}

export function stripSuffix(titleId) {
  return titleId.replace(/_\d{2}$/, '');
}

const JUNK_PATTERNS = [/entitlement/i, /\((?:prod|dev|qa|test|internal|beta)\)/i];
export function isJunk(row) {
  const name = row.name ?? '';
  if (name.trim() === '') return true;
  return JUNK_PATTERNS.some((re) => re.test(name));
}

export function dedupeByConcept(rows) {
  const byConcept = new Map();
  for (const row of rows) {
    if (isJunk(row)) continue;
    if (!byConcept.has(row.conceptId)) byConcept.set(row.conceptId, []);
    byConcept.get(row.conceptId).push(row);
  }
  const games = [];
  for (const [conceptId, list] of byConcept) {
    list.sort(
      (a, b) => regionRank(a.region) - regionRank(b.region) || a.titleId.localeCompare(b.titleId),
    );
    const primary = list[0];
    games.push({
      conceptId,
      titleId: stripSuffix(primary.titleId),
      allTitleIds: [...new Set(list.map((r) => stripSuffix(r.titleId)))].sort(),
      name: primary.name,
      region: primary.region,
    });
  }
  return games.sort((a, b) => a.titleId.localeCompare(b.titleId));
}

export function mergeExisting(fresh, existing) {
  const prev = new Map(existing.map((g) => [g.conceptId, g]));
  return fresh.map((g) => {
    const old = prev.get(g.conceptId);
    if (!old) return g;
    const withOverrides =
      old.commentsDisabled === undefined
        ? g
        : { ...g, commentsDisabled: old.commentsDisabled };
    if (!old.enriched) return withOverrides;
    const { name, cover, publisher, releaseDate, genres, enriched, noStore } = old;
    return { ...withOverrides, name, cover, publisher, releaseDate, genres, enriched, noStore };
  });
}
