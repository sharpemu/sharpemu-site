export const API_ORIGIN = 'https://sharpemu.inferno-tools.com';

export interface RunnerGame {
  id: string;
  name: string;
  titleId: string;
}

export interface GameRun {
  status?: string;
  reason?: string | null;
  queuedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  stage?: string | null;
  video?: string | null;
  evidence?: string | null;
}

export interface PullRequestRun {
  number: number;
  title: string;
  author: string;
  url: string;
  verdict: string;
  draft?: boolean;
  lastTestedAt?: string | null;
  headRepoFull?: string | null;
  headRef?: string | null;
  headSha?: string | null;
  baseBranch?: string | null;
  games?: Record<string, GameRun | undefined>;
}

export interface RunnerState {
  generatedAt: string;
  games: RunnerGame[];
  prs: PullRequestRun[];
  queue?: {
    running?: number;
    waiting?: number;
  };
  repo?: {
    url?: string;
  };
}

export async function fetchRunnerState(): Promise<RunnerState> {
  const response = await fetch(`${API_ORIGIN}/api/state`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Runner returned ${response.status}`);
  return response.json() as Promise<RunnerState>;
}

export function safeUrl(value?: string | null, fallback = '#'): string {
  try {
    const url = new URL(value ?? '', API_ORIGIN);
    return url.protocol === 'https:' ? url.href : fallback;
  } catch {
    return fallback;
  }
}

export function shortSha(sha?: string | null): string {
  return sha ? sha.slice(0, 8) : 'unknown';
}

export function relativeTime(value?: string | null): string {
  if (!value) return 'not tested';

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 'not tested';

  const seconds = Math.max(0, (Date.now() - parsed) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'Recording';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
