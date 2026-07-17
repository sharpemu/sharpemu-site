import { z } from 'astro/zod';

export const STATUSES = ['nothing', 'boots', 'menus', 'ingame', 'playable'] as const;
export type Status = (typeof STATUSES)[number];
export type DisplayStatus = Status | 'untested';

export const compatSchema = z.object({
  titleId: z.string().regex(/^PPSA\d{5}$/),
  status: z.enum(STATUSES),
  testedVersion: z.string().min(1),
  testedDate: z.coerce.date(),
  os: z.enum(['windows', 'linux', 'macos']),
  hardware: z.string().optional(),
  score: z.number().int().min(1).max(5).optional(),
});

// Light-tinted badges for the Console Shell design system. barColor hexes are
// validated for adjacent-segment CVD separation on the light surface
// (dataviz validate_palette.js) — change them only as a set.
export const STATUS_META: Record<
  DisplayStatus,
  { label: string; badgeClass: string; barColor: string; description: string }
> = {
  nothing: {
    label: 'Nothing',
    badgeClass: 'bg-red-100 text-red-700',
    barColor: '#991b1b',
    description: 'Crashes or shows no output.',
  },
  boots: {
    label: 'Boots',
    badgeClass: 'bg-orange-100 text-orange-700',
    barColor: '#fb923c',
    description: 'Shows splash or intro output, no further.',
  },
  menus: {
    label: 'Menus',
    badgeClass: 'bg-amber-100 text-amber-700',
    barColor: '#a16207',
    description: 'Reaches interactive menus.',
  },
  ingame: {
    label: 'Ingame',
    badgeClass: 'bg-blue-100 text-blue-700',
    barColor: '#2563eb',
    description: 'Reaches gameplay with major issues.',
  },
  playable: {
    label: 'Playable',
    badgeClass: 'bg-green-100 text-green-700',
    barColor: '#16a34a',
    description: 'Completable with minor or no issues.',
  },
  untested: {
    label: 'Not tested',
    badgeClass: 'bg-slate-200/70 text-slate-600',
    barColor: '#cbd5e1',
    description: 'No compatibility report yet.',
  },
};

export function computeStats(statuses: string[]) {
  const counts: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const s of statuses) counts[s] = (counts[s] ?? 0) + 1;
  return { tested: statuses.length, counts };
}
