// Releases are fetched at build time and rendered to HTML strings, one view per
// OS: Windows and Linux come from the main repo's releases, macOS from the
// separate sharpemu-mac repo.

import { SITE } from '../config';
import type { Os } from './compat';

export type Asset = { name: string; size: number; browser_download_url: string };
export type Release = {
  name: string;
  tag_name: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  assets: Asset[];
};

const apiUrl = (repoUrl: string) =>
  `${repoUrl.replace('https://github.com/', 'https://api.github.com/repos/')}/releases?per_page=30`;

export const RELEASES_API = apiUrl(SITE.repoUrl);
export const MAC_RELEASES_API = apiUrl(SITE.macRepoUrl);

/**
 * Versioned releases only — rolling win64-main-* CI builds are linked separately.
 * sharpemu-mac hasn't settled on the `v\d` tag convention, so its fetch passes
 * versionedOnly = false rather than risk hiding real releases.
 */
export function selectReleases(all: Release[], limit = 3, versionedOnly = true): Release[] {
  return all
    .filter((r) => !r.draft && (!versionedOnly || /^v\d/.test(r.tag_name)))
    .slice(0, limit)
    // Tags like v0.0.2-beta.2 aren't flagged prerelease upstream; label them anyway.
    .map((r) => ({ ...r, prerelease: r.prerelease || /-(beta|alpha|rc)/i.test(r.tag_name) }));
}

async function fetchFrom(url: string, token: string | undefined, versionedOnly: boolean) {
  const headers: Record<string, string> = { accept: 'application/vnd.github+json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`releases fetch failed: HTTP ${res.status}`);
  // Not capped here: renderDownloads limits per OS, after dropping releases with no asset for it.
  return selectReleases(await res.json(), Infinity, versionedOnly);
}

/** Windows and Linux builds (sharpemu/sharpemu). */
export const fetchReleases = (token?: string) => fetchFrom(RELEASES_API, token, true);

/** macOS builds (sharpemu/sharpemu-mac) — empty until that repo publishes a release. */
export const fetchMacReleases = (token?: string) => fetchFrom(MAC_RELEASES_API, token, false);

/** Which OS an archive is for, from tokens in its name (…-win-x64.zip, …-osx-x64.tar.gz). */
export function classifyAsset(name: string): Os | null {
  const tokens = name.toLowerCase().split(/[^a-z0-9]+/);
  if (tokens.some((t) => /^win(dows)?(32|64)?$/.test(t))) return 'windows';
  if (tokens.includes('linux')) return 'linux';
  if (tokens.some((t) => ['osx', 'macos', 'mac', 'darwin'].includes(t))) return 'macos';
  return null;
}

const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const fmtSize = (b: number) =>
  b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(1)} MB`;

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

function assetHtml(a: Asset): string {
  return `<li>
    <a href="${esc(a.browser_download_url)}" class="group flex items-center gap-3 rounded-xl border border-line px-5 py-3 transition-colors hover:border-accent/40 hover:bg-accent/[0.06]">
      <span class="min-w-0 flex-1 truncate font-mono text-[13px] font-medium group-hover:text-accent">${esc(a.name)}</span>
      <span class="shrink-0 text-xs text-muted">${esc(fmtSize(a.size))}</span>
      <span class="shrink-0 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg">Download</span>
    </a>
  </li>`;
}

function releaseHtml(r: Release, isFirst: boolean): string {
  const badge = r.prerelease
    ? '<span class="rounded-full badge badge-menus px-3 py-0.5 text-xs">Pre-release</span>'
    : isFirst
      ? '<span class="rounded-full badge badge-playable px-3 py-0.5 text-xs">Latest</span>'
      : '';
  const body =
    r.assets.length > 0
      ? `<ul class="mt-5 space-y-2.5">${r.assets.map(assetHtml).join('')}</ul>`
      : `<p class="mt-4 text-sm text-muted">No binaries attached — <a href="${esc(r.html_url)}" class="text-accent underline">view the release on GitHub</a>.</p>`;
  return `<div class="rounded-2xl border border-line bg-surface p-7">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="font-display text-xl font-bold tracking-tight">${esc(r.name || r.tag_name)}</h2>
      ${badge}
      <span class="ml-auto font-mono text-xs text-muted">${esc(fmtDate(r.published_at))}</span>
    </div>
    ${body}
  </div>`;
}

/** Build-from-source card, shown when no release is available to list. */
function fallbackHtml(os: Os): string {
  const mac = os === 'macos';
  const repoUrl = mac ? SITE.macRepoUrl : SITE.repoUrl;
  const dir = repoUrl.split('/').pop();
  return `<div class="rounded-2xl border border-line bg-surface p-7">
    <h2 class="font-display text-xl font-bold tracking-tight">No packaged builds right now</h2>
    <p class="mt-3 text-sm leading-relaxed text-muted">Check the <a href="${repoUrl}/releases" class="text-accent underline">releases page on GitHub</a> — or build from source with the .NET SDK:</p>
    <pre class="mt-5 overflow-x-auto rounded-xl bg-code p-5 font-mono text-[13px] leading-relaxed text-code-fg"><code>git clone ${repoUrl}.git
cd ${dir}
dotnet publish</code></pre>
    ${mac ? '' : '<p class="mt-3 text-sm text-muted">Build artifacts land in the <code>artifacts</code> directory.</p>'}
  </div>`;
}

/**
 * One OS's view. `releases` must come from that OS's repo (fetchMacReleases for
 * macOS, fetchReleases otherwise). The main repo still attaches old osx archives,
 * which never show up because the macOS view doesn't read that repo.
 */
export function renderDownloads(releases: Release[], os: Os, limit = 3): string {
  // sharpemu-mac is macOS-only, so its unclassifiable assets (no "osx" in the name) still count.
  const forOs = (a: Asset) => {
    const c = classifyAsset(a.name);
    return c === os || (os === 'macos' && c === null);
  };
  const shown = releases
    // Releases with no binaries at all keep their "view on GitHub" note; ones that
    // only ship other OSes' archives are skipped.
    .map((r) => ({ ...r, assets: r.assets.filter(forOs), hadAssets: r.assets.length > 0 }))
    .filter((r) => r.assets.length > 0 || !r.hadAssets)
    .slice(0, limit);
  if (shown.length === 0) return fallbackHtml(os);
  const repoUrl = os === 'macos' ? SITE.macRepoUrl : SITE.repoUrl;
  return `<div class="space-y-6">
    ${shown.map((r, i) => releaseHtml(r, i === 0)).join('')}
    <p class="text-sm text-muted">Want the newest changes? Rolling development builds are published for every commit — <a href="${repoUrl}/releases" class="text-accent underline">all releases on GitHub →</a></p>
  </div>`;
}
