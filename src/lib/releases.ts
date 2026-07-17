// One renderer for both sides: the build renders this into the page (so the
// list works without JS and for crawlers), then the browser re-fetches on load
// so a new GitHub release shows up without waiting for a redeploy.

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

export const RELEASES_API = 'https://api.github.com/repos/sharpemu/sharpemu/releases?per_page=30';
const REPO_URL = 'https://github.com/sharpemu/sharpemu';

/** Versioned releases only — rolling win64-main-* CI builds are linked separately. */
export function selectReleases(all: Release[], limit = 3): Release[] {
  return all
    .filter((r) => !r.draft && /^v\d/.test(r.tag_name))
    .slice(0, limit)
    // Tags like v0.0.2-beta.2 aren't flagged prerelease upstream; label them anyway.
    .map((r) => ({ ...r, prerelease: r.prerelease || /-(beta|alpha|rc)/i.test(r.tag_name) }));
}

export async function fetchReleases(token?: string): Promise<Release[]> {
  const headers: Record<string, string> = { accept: 'application/vnd.github+json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(RELEASES_API, { headers });
  if (!res.ok) throw new Error(`releases fetch failed: HTTP ${res.status}`);
  return selectReleases(await res.json());
}

const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const fmtSize = (b: number) =>
  b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(1)} MB`;

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

function assetHtml(a: Asset): string {
  return `<li>
    <a href="${esc(a.browser_download_url)}" class="group flex items-center gap-3 rounded-xl border border-ink/8 px-5 py-3 transition-colors hover:border-psblue/40 hover:bg-psblue/[0.03]">
      <span class="min-w-0 flex-1 truncate font-mono text-[13px] font-medium group-hover:text-psblue">${esc(a.name)}</span>
      <span class="shrink-0 text-xs text-muted">${esc(fmtSize(a.size))}</span>
      <span class="shrink-0 rounded-full bg-psblue px-4 py-1.5 text-xs font-semibold text-white">Download</span>
    </a>
  </li>`;
}

function releaseHtml(r: Release, isFirst: boolean): string {
  const badge = r.prerelease
    ? '<span class="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800">Pre-release</span>'
    : isFirst
      ? '<span class="rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700">Latest</span>'
      : '';
  const body =
    r.assets.length > 0
      ? `<ul class="mt-5 space-y-2.5">${r.assets.map(assetHtml).join('')}</ul>`
      : `<p class="mt-4 text-sm text-muted">No binaries attached — <a href="${esc(r.html_url)}" class="text-psblue underline">view the release on GitHub</a>.</p>`;
  return `<div class="rounded-2xl border border-ink/8 bg-white/70 p-7">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="font-display text-xl font-bold tracking-tight">${esc(r.name || r.tag_name)}</h2>
      ${badge}
      <span class="ml-auto font-mono text-xs text-muted">${esc(fmtDate(r.published_at))}</span>
    </div>
    ${body}
  </div>`;
}

/** Build-from-source card, shown when no release is available to list. */
function fallbackHtml(): string {
  return `<div class="rounded-2xl border border-ink/8 bg-white/70 p-7">
    <h2 class="font-display text-xl font-bold tracking-tight">No packaged builds right now</h2>
    <p class="mt-3 text-sm leading-relaxed text-muted">Check the <a href="${REPO_URL}/releases" class="text-psblue underline">releases page on GitHub</a> — or build from source with the .NET SDK:</p>
    <pre class="mt-5 overflow-x-auto rounded-xl bg-ink p-5 font-mono text-[13px] leading-relaxed text-slate-200"><code>git clone ${REPO_URL}.git
cd sharpemu
dotnet publish</code></pre>
    <p class="mt-3 text-sm text-muted">Build artifacts land in the <code>artifacts</code> directory.</p>
  </div>`;
}

export function renderDownloads(releases: Release[]): string {
  if (releases.length === 0) return fallbackHtml();
  return `<div class="space-y-6">
    ${releases.map((r, i) => releaseHtml(r, i === 0)).join('')}
    <p class="text-sm text-muted">Want the newest changes? Rolling development builds are published for every commit — <a href="${REPO_URL}/releases" class="text-psblue underline">all releases on GitHub →</a></p>
  </div>`;
}
