import { z } from 'astro/zod';

export const STATUSES = ['nothing', 'boots', 'menus', 'ingame', 'playable'] as const;
export type Status = (typeof STATUSES)[number];
export type DisplayStatus = Status | 'untested';

export const compatSchema = z.object({
  titleId: z.string().regex(/^PPSA\d{5}$/),
  status: z.enum(STATUSES),
  testedVersion: z.string().min(1),
  testedDate: z.coerce.date(),
  gameVersion: z.string().min(1).optional(),
  os: z.enum(['windows', 'linux', 'macos']),
  hardware: z.string().optional(),
  score: z.number().int().min(1).max(5).optional(),
  commentsDisabled: z.boolean().optional(),
});

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
