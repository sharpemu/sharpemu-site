export const SITE = {
  name: 'SharpEmu',
  tagline: 'An experimental PlayStation 5 and PlayStation 4 emulator for Windows, Linux and macOS.',
  description:
    'SharpEmu is an experimental, open-source PlayStation 5 emulator written from scratch in C#, with PlayStation 4 support in development. Track game compatibility for both consoles, read reports, and follow development.',
  repoUrl: 'https://github.com/sharpemu/sharpemu',
  // macOS builds (Metal renderer) live in their own repo; Windows and Linux ship from repoUrl.
  macRepoUrl: 'https://github.com/sharpemu/sharpemu-mac',
  siteRepoUrl: 'https://github.com/sharpemu/sharpemu-site', // TODO: adjust once the site repo exists in the org
  // Bump when a new SharpEmu build is released; reports tested on other
  // versions get an "older build" note. null ⇒ no packaged release yet, so no note.
  currentVersion: {
    windows: '0.0.2-beta.2',
    linux: '0.0.2-beta.2',
    macos: null,
  } as Record<'windows' | 'linux' | 'macos', string | null>,
};

// IDs from the repo's GitHub Discussions (same values giscus.app generates).
// Announcements is an announcement-type category: only maintainers and giscus
// can open discussions, which is what giscus recommends for comment threads.
// Empty repoId ⇒ comments UI shows a setup note instead.
export const GISCUS = {
  repo: 'sharpemu/sharpemu-site',
  repoId: 'R_kgDOTbDwWg',
  category: 'Announcements',
  categoryId: 'DIC_kwDOTbDwWs4DBXOX',
};
