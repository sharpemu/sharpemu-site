import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const pageUrl = new URL('./src/pages/index.astro', import.meta.url);
const clientUrl = new URL('./src/components/DashboardClient.astro', import.meta.url);
const workspaceUrl = new URL(
  './src/components/PullRequestWorkspace.astro',
  import.meta.url,
);
const configUrl = new URL('./astro.config.mjs', import.meta.url);
const sourceUrl = new URL('./src/', import.meta.url);

describe('Astro PR dashboard', () => {
  it('uses layouts and components instead of a monolithic page', async () => {
    const page = await readFile(pageUrl, 'utf8');

    expect(page).toContain("import DashboardLayout from '../layouts/DashboardLayout.astro'");
    expect(page).toContain('<DashboardHeader />');
    expect(page).toContain('<PullRequestWorkspace />');
    expect(page).toContain('<DashboardClient />');
    expect(page).not.toContain('<iframe');
    expect(page).not.toContain("import '../styles/");
    expect(page).not.toContain("import '../scripts/");
  });

  it('keeps live behavior in a typed Astro client component', async () => {
    const client = await readFile(clientUrl, 'utf8');

    expect(client).toContain("import { buildResultHash, parseResultHash }");
    expect(client).toContain('dashboard.data = await fetchRunnerState()');
    expect(client).toContain("window.addEventListener('hashchange', applyLocationHash)");
    expect(client).not.toContain('innerHTML');
  });

  it('renders addressable evidence and metadata-preloaded recordings', async () => {
    const workspace = await readFile(workspaceUrl, 'utf8');

    expect(workspace).toContain('data-game-permalink');
    expect(workspace).toContain('Evidence archive');
    expect(workspace).toContain('preload="metadata"');
    expect(workspace).toContain('data-recording-video');
  });

  it('shares the main Astro Tailwind system without local JS or CSS source files', async () => {
    const config = await readFile(configUrl, 'utf8');
    const sourceFiles = await readdir(sourceUrl, { recursive: true });

    expect(config).toContain("import tailwindcss from '@tailwindcss/vite'");
    expect(config).toContain('plugins: [tailwindcss()]');
    expect(
      sourceFiles.filter((file) => file.endsWith('.js') || file.endsWith('.css')),
    ).toEqual([]);
  });

  it('credits the runner maintainer without proxying the source page', async () => {
    const header = await readFile(
      new URL('./src/components/DashboardHeader.astro', import.meta.url),
      'utf8',
    );
    const client = await readFile(clientUrl, 'utf8');

    expect(header).toContain('https://github.com/Spooks4576');
    expect(client).not.toContain('fetch(`${API_ORIGIN}/`');
  });
});
