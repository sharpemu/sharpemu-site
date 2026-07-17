# SharpEmu website

Static site for [SharpEmu](https://github.com/sharpemu/sharpemu) — landing page
and PS5 game compatibility database. Built with Astro + Tailwind, deployed on
Cloudflare Pages.

## Development

```bash
npm install
npm run dev        # dev server (Pagefind search 404s in dev — build first)
# /downloads fetches GitHub releases at build time; set GITHUB_TOKEN to avoid
# anonymous rate limits: GITHUB_TOKEN=$(gh auth token) npm run build
npm test           # vitest
npm run build      # static build into dist/ + Pagefind index
npm run preview    # serve dist/
```

## Games database

`src/data/games.json` is generated — do not edit by hand.

```bash
npm run import                          # refresh title list (no enrichment)
npm run import -- --enrich 300          # + enrich 300 concepts with covers/metadata
npm run import -- --only PPSA01284      # enrich specific title IDs (comma-separated)
npm run import -- --force               # accept a >5% shrink of the list
```

Sources: [andshrew/PlayStation-Titles](https://github.com/andshrew/PlayStation-Titles)
(MIT, title IDs/names/regions) + the public PlayStation Store GraphQL endpoint
(covers, publisher, release date, genres — hotlinked, throttled, incremental).
A weekly GitHub Action refreshes the list and enriches 300 new concepts per run.

### Refreshing the PSN query hash

If the import fails with "persisted-query hash rejected (HTTP 400)": open a
PS5 game page on store.playstation.com with browser devtools → Network, filter
`metGetConceptById`, copy `extensions.persistedQuery.sha256Hash` from the
request, and update `PSN_HASH` in `scripts/lib/enrich.mjs`.

## Compatibility reports

One markdown file per tested game in `src/content/compat/<TITLEID>.md` —
schema in `src/lib/compat.ts`, guide at `/compatibility/report`.
Status ladder: `nothing → boots → menus → ingame → playable`.

A report may use any regional title ID (e.g. `PPSA10112`); the site resolves
it to the game's primary entry automatically. The build fails on reports whose
title ID isn't in the database or whose filename doesn't match the front
matter.

## Downloads page

`/downloads` renders GitHub releases from `sharpemu/sharpemu` **at build time**
(`src/lib/releases.ts`) — no client-side API calls, so visitors never hit
GitHub's per-IP rate limit. Freshness is push-based: publishing a release fires
`notify-site.yml` in the emulator repo, which sends a `repository_dispatch` to
this repo and redeploys within ~a minute. `deploy.yml` also rebuilds daily as a
safety net, and can be run by hand from the Actions tab.

Requires the `SITE_DISPATCH_TOKEN` secret on `sharpemu/sharpemu` (fine-grained
PAT scoped to this repo, Contents: read and write).

## Deploying (Cloudflare Pages)

1. Push this repo to GitHub (public, so giscus + issue templates work).
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo.
   Build command `npm run build`, output directory `dist`, Node version 22.
3. Custom domain: add the domain to Cloudflare (free plan). Cloudflare shows
   two nameservers. In the Vercel dashboard (where the domain is registered):
   Domains → your domain → Nameservers → replace with Cloudflare's pair.
   Registration stays at Vercel; DNS + hosting move to Cloudflare. Then Pages
   → Custom domains → add the domain. Update `site` in `astro.config.mjs`.

## Enabling comments (giscus)

1. Repo must be public with Discussions enabled; create a "Game compatibility"
   discussion category (Announcements type recommended).
2. Install the giscus app (github.com/apps/giscus) on the repo.
3. On [giscus.app](https://giscus.app), pick the repo/category, copy `repoId`
   and `categoryId` into `GISCUS` in `src/config.ts`.

## License

Site code is MIT (see LICENSE). Game names/metadata via andshrew (MIT). Cover
art is served from the PlayStation Store and belongs to its publishers —
takedown requests: open an issue. Not affiliated with Sony Interactive
Entertainment.
