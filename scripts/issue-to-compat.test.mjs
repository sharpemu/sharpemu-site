import { describe, expect, it } from 'vitest';
import {
  chooseReportTarget,
  normalizeReport,
  parseIssueForm,
  renderReport,
  sanitizeIssueMarkdown,
} from './issue-to-compat.mjs';

const games = [
  {
    name: "Demon's Souls",
    titleId: 'PPSA01339',
    allTitleIds: ['PPSA01339', 'PPSA01342'],
  },
];

const currentIssue = {
  number: 4,
  url: 'https://github.com/sharpemu/sharpemu-site/issues/4',
  createdAt: '2026-07-17T07:49:21Z',
  body: `### Title ID

PPSA01342

### Compatibility status

boots

### SharpEmu version (commit or release)

24b82a7

### Operating system

windows

### Hardware (CPU / GPU)

Ryzen 9 9950X3D / RTX 5090

### What works / what breaks

Boots after the splash screen.

<img alt="Brightness screen" src="https://github.com/user-attachments/assets/example" />
`,
};

describe('issue compatibility report converter', () => {
  it('parses GitHub issue-form sections', () => {
    const sections = parseIssueForm(currentIssue.body);

    expect(sections.get('Title ID')).toBe('PPSA01342');
    expect(sections.get('Compatibility status')).toBe('boots');
  });

  it('supports legacy issues and records inferred fields as warnings', () => {
    const report = normalizeReport(currentIssue, games);

    expect(report.testedDate).toBe('2026-07-17');
    expect(report.titleId).toBe('PPSA01342');
    expect(report.warnings).toHaveLength(2);
  });

  it('accepts the current issue form fields', () => {
    const issue = {
      ...currentIssue,
      body: `### Title ID

PPSA01342

### Compatibility status

boots

### SharpEmu build (commit or release, not the game version)

24b82a7

### Test date

2026-07-16

### Game version

1.004

### Operating system

windows

### Hardware (CPU / GPU)

Ryzen 9 9950X3D / RTX 5090

### What works / what breaks

Reaches the intro and then stops.

### Testing confirmation

- [X] I tested a dump of a game I own.
`,
    };

    const report = normalizeReport(issue, games);

    expect(report.testedDate).toBe('2026-07-16');
    expect(report.gameVersion).toBe('1.004');
    expect(report.os).toBe('windows');
    expect(report.warnings).toEqual([]);
  });

  it('converts trusted GitHub attachment images and strips other HTML', () => {
    const markdown = sanitizeIssueMarkdown(
      '<img alt="Frame" src="https://github.com/user-attachments/assets/123" /><script>alert(1)</script>',
    );

    expect(markdown).toBe(
      '![Frame](https://github.com/user-attachments/assets/123)alert(1)',
    );
    expect(markdown).not.toContain('<script>');
  });

  it('updates an existing regional report instead of creating a duplicate', () => {
    const report = normalizeReport(currentIssue, games);

    expect(chooseReportTarget(report, ['PPSA01339.md'])).toEqual({
      fileName: 'PPSA01339.md',
      titleId: 'PPSA01339',
      updating: true,
    });
  });

  it('renders validated frontmatter and a source backlink', () => {
    const report = normalizeReport(currentIssue, games);
    const markdown = renderReport(report);

    expect(markdown).toContain('titleId: "PPSA01342"');
    expect(markdown).toContain('testedVersion: "24b82a7"');
    expect(markdown).toContain('testedDate: "2026-07-17"');
    expect(markdown).toContain('GitHub compatibility report #4');
  });

  it('rejects title IDs that are not in the catalog', () => {
    const issue = {
      ...currentIssue,
      body: currentIssue.body.replace('PPSA01342', 'PPSA99999'),
    };

    expect(() => normalizeReport(issue, games)).toThrow('is not in the game catalog');
  });
});
