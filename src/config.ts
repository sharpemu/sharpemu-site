export const SITE = {
  name: 'SharpEmu',
  tagline: 'An experimental PlayStation 5 emulator for Windows, Linux and macOS.',
  description:
    'SharpEmu is an experimental, open-source PlayStation 5 emulator written from scratch in C#. Track game compatibility, read reports, and follow development.',
  repoUrl: 'https://github.com/sharpemu/sharpemu',
  siteRepoUrl: 'https://github.com/sharpemu/sharpemu-site', // TODO: adjust once the site repo exists in the org
  // Bump when a new SharpEmu build is released; reports tested on other
  // versions get an "older build" note.
  currentVersion: '0.0.2',
};

// Fill in from https://giscus.app after the site repo is public with
// Discussions enabled. Empty repoId ⇒ comments UI shows a setup note.
export const GISCUS = {
  repo: 'sharpemu/sharpemu-site',
  repoId: '',
  category: 'Game compatibility',
  categoryId: '',
};
