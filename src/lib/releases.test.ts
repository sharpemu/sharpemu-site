import { describe, it, expect } from 'vitest';
import { selectReleases, renderDownloads, fmtSize, type Release } from './releases';

const rel = (over: Partial<Release> = {}): Release => ({
  name: 'SharpEmu v0.0.2',
  tag_name: 'v0.0.2',
  html_url: 'https://github.com/sharpemu/sharpemu/releases/tag/v0.0.2',
  published_at: '2026-07-01T00:00:00Z',
  prerelease: false,
  draft: false,
  assets: [
    { name: 'sharpemu-0.0.2-win-x64.zip', size: 84_000_000, browser_download_url: 'https://x/w.zip' },
  ],
  ...over,
});

describe('selectReleases', () => {
  it('keeps only versioned tags, dropping rolling CI builds', () => {
    const out = selectReleases([rel(), rel({ tag_name: 'win64-main-fa2616d' })]);
    expect(out.map((r) => r.tag_name)).toEqual(['v0.0.2']);
  });
  it('drops drafts', () => {
    expect(selectReleases([rel({ draft: true })])).toHaveLength(0);
  });
  it('labels beta tags as prerelease even when upstream does not', () => {
    const [out] = selectReleases([rel({ tag_name: 'v0.0.2-beta.2', prerelease: false })]);
    expect(out.prerelease).toBe(true);
  });
  it('limits how many releases are listed', () => {
    expect(selectReleases([rel(), rel(), rel(), rel()], 3)).toHaveLength(3);
  });
});

describe('renderDownloads', () => {
  it('renders a Latest badge on the first stable release only', () => {
    const html = renderDownloads(selectReleases([rel(), rel({ tag_name: 'v0.0.1' })]));
    expect(html.match(/Latest/g)).toHaveLength(1);
  });
  it('renders a Pre-release badge instead for betas', () => {
    const html = renderDownloads(selectReleases([rel({ tag_name: 'v0.0.3-beta.1' })]));
    expect(html).toContain('Pre-release');
    expect(html).not.toContain('>Latest<');
  });
  it('lists assets with download links and sizes', () => {
    const html = renderDownloads(selectReleases([rel()]));
    expect(html).toContain('sharpemu-0.0.2-win-x64.zip');
    expect(html).toContain('https://x/w.zip');
    expect(html).toContain('84.0 MB');
  });
  it('escapes hostile release names', () => {
    const html = renderDownloads(selectReleases([rel({ name: '<img src=x onerror=alert(1)>' })]));
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&#60;img');
  });
  it('falls back to build-from-source when there are no releases', () => {
    const html = renderDownloads([]);
    expect(html).toContain('No packaged builds right now');
    expect(html).toContain('dotnet publish');
  });
  it('links releases with no attached binaries to GitHub', () => {
    const html = renderDownloads(selectReleases([rel({ assets: [] })]));
    expect(html).toContain('No binaries attached');
  });
});

describe('fmtSize', () => {
  it('uses MB under a gigabyte and GB above', () => {
    expect(fmtSize(84_000_000)).toBe('84.0 MB');
    expect(fmtSize(1_500_000_000)).toBe('1.5 GB');
  });
});
