import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const pageUrl = new URL('./src/pages/index.astro', import.meta.url);
const scriptUrl = new URL('./src/scripts/dashboard.js', import.meta.url);

describe('standalone PR dashboard', () => {
  it('loads its own assets without embedding or proxying the source page', async () => {
    const html = await readFile(pageUrl, 'utf8');

    expect(html).toContain("import '../styles/dashboard.css';");
    expect(html).toContain("<script>\n      import '../scripts/dashboard.js';");
    expect(html).toContain('https://github.com/Spooks4576');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('sharpemu.inferno-tools.com');
  });

  it('uses only the runner API and artifact origin from browser-side code', async () => {
    const script = await readFile(scriptUrl, 'utf8');

    expect(script).toContain(
      "const API_ORIGIN = 'https://sharpemu.inferno-tools.com';",
    );
    expect(script).toContain("fetch(`${API_ORIGIN}/api/state`");
    expect(script).toContain('preload="metadata"');
    expect(script).toContain("video.addEventListener('loadedmetadata'");
    expect(script).not.toContain('fetch(`${API_ORIGIN}/`');
  });
});
