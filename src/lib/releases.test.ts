import { describe, it, expect } from 'vitest';
import { selectReleases, renderDownloads, classifyAsset, fmtSize, type Release } from './releases';

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

const multi = (over: Partial<Release> = {}) =>
  rel({
    assets: [
      { name: 'sharpemu-0.0.6-mono-win-x64.zip', size: 84_000_000, browser_download_url: 'https://x/w.zip' },
      { name: 'sharpemu-0.0.6-mono-linux-x64.tar.gz', size: 80_000_000, browser_download_url: 'https://x/l.tgz' },
      { name: 'sharpemu-0.0.6-mono-osx-x64.tar.gz', size: 70_000_000, browser_download_url: 'https://x/o.tgz' },
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
  it('keeps untagged-convention releases when versionedOnly is off (sharpemu-mac)', () => {
    const out = selectReleases([rel({ tag_name: 'macos-1' }), rel({ draft: true })], 3, false);
    expect(out.map((r) => r.tag_name)).toEqual(['macos-1']);
  });
});

describe('classifyAsset', () => {
  it('classifies assets by OS token in the name', () => {
    expect(classifyAsset('sharpemu-0.0.6-mono-win-x64.zip')).toBe('windows');
    expect(classifyAsset('sharpemu-0.0.6-mono-linux-x64.tar.gz')).toBe('linux');
    expect(classifyAsset('sharpemu-0.0.6-mono-osx-x64.tar.gz')).toBe('macos');
    expect(classifyAsset('SharpEmu-macos-arm64.zip')).toBe('macos');
    expect(classifyAsset('sharpemu-darwin.tar.gz')).toBe('macos');
  });
  it('returns null when the name has no OS token', () => {
    expect(classifyAsset('SHA256SUMS.txt')).toBeNull();
    expect(classifyAsset('sharpemu-winter-build.zip')).toBeNull();
  });
});

describe('renderDownloads', () => {
  it('renders a Latest badge on the first stable release only', () => {
    const html = renderDownloads(selectReleases([rel(), rel({ tag_name: 'v0.0.1' })]), 'windows');
    expect(html.match(/Latest/g)).toHaveLength(1);
  });
  it('renders a Pre-release badge instead for betas', () => {
    const html = renderDownloads(selectReleases([rel({ tag_name: 'v0.0.3-beta.1' })]), 'windows');
    expect(html).toContain('Pre-release');
    expect(html).not.toContain('>Latest<');
  });
  it('lists assets with download links and sizes', () => {
    const html = renderDownloads(selectReleases([rel()]), 'windows');
    expect(html).toContain('sharpemu-0.0.2-win-x64.zip');
    expect(html).toContain('https://x/w.zip');
    expect(html).toContain('84.0 MB');
  });
  it('escapes hostile release names', () => {
    const html = renderDownloads(selectReleases([rel({ name: '<img src=x onerror=alert(1)>' })]), 'windows');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&#60;img');
  });
  it('falls back to build-from-source when there are no releases', () => {
    const html = renderDownloads([], 'windows');
    expect(html).toContain('No packaged builds right now');
    expect(html).toContain('dotnet publish');
    expect(html).toContain('git clone https://github.com/sharpemu/sharpemu.git');
  });
  it('falls back to building sharpemu-mac when macOS has no releases', () => {
    const html = renderDownloads([], 'macos');
    expect(html).toContain('git clone https://github.com/sharpemu/sharpemu-mac.git');
    expect(html).toContain('cd sharpemu-mac');
    expect(html).toContain('dotnet publish');
  });
  it('lists only the Windows archive in the Windows view', () => {
    const html = renderDownloads(selectReleases([multi()]), 'windows');
    expect(html).toContain('win-x64.zip');
    expect(html).not.toContain('linux-x64');
    expect(html).not.toContain('osx-x64');
  });
  it('lists only the Linux archive in the Linux view', () => {
    const html = renderDownloads(selectReleases([multi()]), 'linux');
    expect(html).toContain('linux-x64.tar.gz');
    expect(html).not.toContain('win-x64');
    expect(html).not.toContain('osx-x64');
  });
  it('never offers the old osx archive from the main repo', () => {
    for (const os of ['windows', 'linux'] as const) {
      expect(renderDownloads(selectReleases([multi()]), os)).not.toContain('osx');
    }
  });
  it('skips releases with no asset for the OS and falls back if none remain', () => {
    const winOnly = rel({ tag_name: 'v0.0.1' });
    const html = renderDownloads(selectReleases([winOnly]), 'linux');
    expect(html).toContain('No packaged builds right now');
  });
  it('lists sharpemu-mac releases, including assets without an OS token', () => {
    const mac = rel({
      tag_name: 'v0.1.0',
      assets: [{ name: 'SharpEmuMac-0.1.0-arm64.zip', size: 50_000_000, browser_download_url: 'https://x/m.zip' }],
    });
    const html = renderDownloads(selectReleases([mac], 3, false), 'macos');
    expect(html).toContain('SharpEmuMac-0.1.0-arm64.zip');
    expect(html).toContain('https://github.com/sharpemu/sharpemu-mac/releases');
    expect(html).not.toContain('No packaged builds');
  });
  it('links releases with no attached binaries to GitHub', () => {
    const html = renderDownloads(selectReleases([rel({ assets: [] })]), 'windows');
    expect(html).toContain('No binaries attached');
  });
});

describe('fmtSize', () => {
  it('uses MB under a gigabyte and GB above', () => {
    expect(fmtSize(84_000_000)).toBe('84.0 MB');
    expect(fmtSize(1_500_000_000)).toBe('1.5 GB');
  });
});
