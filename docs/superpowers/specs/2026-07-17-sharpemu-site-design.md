# SharpEmu Website — Design

Date: 2026-07-17
Status: Approved (user approved design + hosting + page scope on 2026-07-17)

## Purpose

Public website for SharpEmu (experimental PS5 emulator, GPL-2.0-or-later):

1. A landing page (project intro, status, downloads/GitHub links).
2. A game compatibility database covering all known PS5 titles, with
   per-game pages, community compatibility reports written as markdown
   files, screenshots, and comments.

Constraints: fully static output, ~$0/month running cost, low maintenance.

## Hosting & domain

- **Host: Cloudflare Pages** (free tier: unlimited bandwidth, commercial
  use allowed, 20k files/deploy, 500 builds/mo). Deployed via git
  integration from GitHub.
- **Domain**: currently registered at Vercel. Keep registration there;
  switch the domain's nameservers to Cloudflare (free plan), then attach
  the domain to the Pages project. No domain transfer required.
- The site is host-agnostic static output; Vercel remains a drop-in
  fallback.

Rationale: Vercel Hobby has a 100 GB/mo bandwidth cap that hard-pauses
the site when exceeded, and a non-commercial-only ToS (donation links are
a gray area). Cloudflare Pages has neither problem.

## Stack

- **Astro** with content collections (Zod-typed markdown frontmatter),
  static output. Near-zero client JS by default.
- **Tailwind CSS** for styling.
- **Pagefind** for site-wide search (build-time chunked index), plus a
  slim prebuilt JSON + client-side filter for the games list page.
- **giscus** (GitHub Discussions) for per-game comments. Zero backend.
  Requires the site repo to be public with Discussions enabled.
- **Images**: optimized at build time via `astro:assets` (Sharp). Never
  use host-side image optimization (paid/limited on Vercel).

## Data model

### Games database (imported)

`src/data/games.json` — generated, committed. One entry per game concept
(~8,700 PS5 games), deduped from ~22k regional title rows:

```jsonc
{
  "conceptId": "10000176",
  "titleId": "PPSA01234",        // primary ID: region priority UP > EP > JP
  "allTitleIds": ["PPSA01234", "PPSA01235"],
  "name": "Returnal",
  "region": "US",
  "cover": "https://image.api.playstation.com/vulcan/...",  // hotlinked
  "genre": "...", "releaseDate": "...", "publisher": "..."   // optional enrichment
}
```

Sources (verified, free, no auth):

1. **andshrew/PlayStation-Titles** (MIT, refreshed daily) — title IDs,
   names, regions, concept IDs. The backbone; no scraping.
2. **PSN Store GraphQL** (`web.np.playstation.com/api/graphql/v1/op`,
   unauthenticated, persisted query `metGetConceptById`) — cover art URL,
   genre, release date, publisher. Enrichment is incremental (only new
   concepts), throttled, cached by conceptId in `scripts/.cache/`.
   The persisted-query sha256 hash is pinned; on HTTP 400, refresh it
   from the live store.

`scripts/import-games.mjs` runs locally and in a **weekly GitHub Action**
that pulls the andshrew diff, enriches new concepts, and commits the
updated `games.json`.

Cover art is hotlinked from Sony's CDN (keeps our bandwidth ~zero;
publishers tolerate non-commercial fan sites — keep a DMCA takedown
path). If URLs rot or get blocked, fall back to caching resized thumbs
in R2 (future work, not v1).

### Compatibility reports (authored)

`src/content/compat/<PPSAxxxxx>.md` — one file per *tested* game,
Zod-validated frontmatter:

```yaml
---
titleId: PPSA01234
status: ingame        # nothing | boots | menus | ingame | playable
testedVersion: v0.3.1 # SharpEmu version
testedDate: 2026-07-17
os: windows           # windows | linux | macos
hardware: "RTX 4070, Ryzen 7600"
score: 4              # optional 1-5 star experience rating (sorting uses status)
screenshots:
  - ./screenshots/PPSA01234-title.png
---
Free-form markdown: what works, what breaks, workarounds.
```

Status ladder (industry convention — shadPS4/Vita3K/Ryujinx):
**nothing → boots → menus → ingame → playable**. Games without a compat
file display as **"Not tested"**.

Staleness (ProtonDB's failure mode): every report stores
`testedVersion`/`testedDate`; pages show a "stale report" badge when the
tested version is old.

Screenshots live in the repo next to the content, optimized at build.

## Pages

- `/` — landing: hero (logo reused from main repo), project status,
  compat summary stats (% per status), links (GitHub, releases).
- `/compatibility` — full games list: client-side filter/search over a
  slim JSON index (titleId, name, status), status badges, summary bar.
- `/game/<titleId>` — one static page per game (~8,700): cover,
  metadata, compat status, latest report (rendered markdown +
  screenshots), giscus comment thread.
- `/compatibility/report` — how to submit a report (PR flow + issue
  template link).

## Submission flow (v1)

Contributors submit reports as PRs editing `src/content/compat/`, or via
a GitHub issue template ("Report compatibility") that maintainers
convert. Zod schema validation runs in CI on every PR. A Vita3K-style
validating bot is future work if volume demands.

## Error handling

- Import script: network failures retry with backoff; enrichment
  failures leave fields empty (page renders without cover); script never
  commits a games.json that shrinks by >5% vs previous (guard against
  upstream truncation).
- Build: compat file referencing an unknown titleId fails the build with
  a clear message (schema/lookup check).

## Testing

- Unit tests for import-script transforms (dedup, region priority, junk
  filter) on fixture data — Vitest.
- CI: schema validation + `astro build` on every PR.
- Visual check of landing/game pages locally before first deploy.

## Out of scope (v1)

- Server-side anything; user accounts; per-user report aggregation
  (multiple reports per game — v1 keeps one canonical file per game).
- Self-hosted cover thumbnails (R2) — only if hotlinking breaks.
- Auto-validating submission bot.
