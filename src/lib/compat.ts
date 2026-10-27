import { z } from 'astro/zod';

export const STATUSES = ['nothing', 'boots', 'menus', 'ingame', 'playable'] as const;
export type Status = (typeof STATUSES)[number];
export type DisplayStatus = Status | 'untested';

// Each game keeps one report per OS, stored at src/content/compat/<os>/<TITLEID>.md.
// Windows is listed first because it's the default view everywhere.
export const OSES = ['windows', 'linux', 'macos'] as const;
export type Os = (typeof OSES)[number];
export const DEFAULT_OS: Os = 'windows';
export const OS_LABEL: Record<Os, string> = { windows: 'Windows', linux: 'Linux', macos: 'macOS' };

// The console a game was released for, read from its title ID prefix. A PS4 game and its
// PS5 version are separate games with separate pages and reports, even when the store
// groups them under one concept.
export const PLATFORMS = ['ps5', 'ps4'] as const;
export type Platform = (typeof PLATFORMS)[number];
export const DEFAULT_PLATFORM: Platform = 'ps5';
export const PLATFORM_LABEL: Record<Platform, string> = { ps5: 'PS5', ps4: 'PS4' };
export const TITLE_ID_PREFIX: Record<Platform, string> = { ps5: 'PPSA', ps4: 'CUSA' };
export const TITLE_ID_RE = /^(PPSA|CUSA)\d{5}$/;
export const platformOf = (titleId: string): Platform => (titleId.startsWith('CUSA') ? 'ps4' : 'ps5');

export const compatSchema = z.object({
  titleId: z.string().regex(TITLE_ID_RE),
  status: z.enum(STATUSES),
  testedVersion: z.string().min(1),
  testedDate: z.coerce.date(),
  gameVersion: z.string().min(1).optional(),
  os: z.enum(OSES),
  // macOS reports made on the old main-repo Mac build, before macOS moved to sharpemu-mac.
  legacyBuild: z.boolean().optional(),
  hardware: z.string().optional(),
  score: z.number().int().min(1).max(5).optional(),
  commentsDisabled: z.boolean().optional(),
});

/** Expected entry id for a report — the glob loader lowercases ids. */
export const reportEntryId = (os: Os, titleId: string) => `${os}/${titleId}`.toLowerCase();

// badgeClass and barColor both resolve through CSS custom properties defined in
// global.css, so a status keeps one identity and each theme supplies its own
// values. The bar hexes are validated per surface for adjacent-segment
// separation and contrast (dataviz validate_palette.js) — change them as a set.
export const STATUS_META: Record<
  DisplayStatus,
  { label: string; badgeClass: string; barColor: string; description: string }
> = {
  nothing: {
    label: 'Nothing',
    badgeClass: 'badge badge-nothing',
    barColor: 'var(--bar-nothing)',
    description: 'Crashes or shows no output.',
  },
  boots: {
    label: 'Boots',
    badgeClass: 'badge badge-boots',
    barColor: 'var(--bar-boots)',
    description: 'Shows splash or intro output, no further.',
  },
  menus: {
    label: 'Menus',
    badgeClass: 'badge badge-menus',
    barColor: 'var(--bar-menus)',
    description: 'Reaches interactive menus.',
  },
  ingame: {
    label: 'Ingame',
    badgeClass: 'badge badge-ingame',
    barColor: 'var(--bar-ingame)',
    description: 'Reaches gameplay with major issues.',
  },
  playable: {
    label: 'Playable',
    badgeClass: 'badge badge-playable',
    barColor: 'var(--bar-playable)',
    description: 'Completable with minor or no issues.',
  },
  untested: {
    label: 'Not tested',
    badgeClass: 'badge badge-untested',
    barColor: 'var(--status-neutral)',
    description: 'No compatibility report yet.',
  },
};

export function computeStats(statuses: string[]) {
  const counts: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const s of statuses) counts[s] = (counts[s] ?? 0) + 1;
  return { tested: statuses.length, counts };
}
