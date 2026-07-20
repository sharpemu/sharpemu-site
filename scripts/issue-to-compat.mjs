import { execFileSync } from 'node:child_process';
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const STATUSES = new Set(['nothing', 'boots', 'menus', 'ingame', 'playable']);
const OPERATING_SYSTEMS = new Set(['windows', 'linux', 'macos']);
const EMPTY_RESPONSES = new Set(['', '_No response_', 'No response']);

export function parseIssueForm(body) {
  const sections = new Map();
  let currentLabel = null;
  let currentLines = [];

  const saveSection = () => {
    if (!currentLabel) return;
    sections.set(currentLabel, currentLines.join('\n').trim());
  };

  for (const line of String(body ?? '').replaceAll('\r\n', '\n').split('\n')) {
    const heading = /^###\s+(.+?)\s*$/.exec(line);
    if (heading) {
      saveSection();
      currentLabel = heading[1];
      currentLines = [];
    } else if (currentLabel) {
      currentLines.push(line);
    }
  }
  saveSection();
  return sections;
}

function sectionValue(sections, ...labels) {
  for (const label of labels) {
    const value = sections.get(label)?.trim() ?? '';
    if (!EMPTY_RESPONSES.has(value)) return value;
  }
  return '';
}

function imageAttribute(tag, name) {
  const expression = new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = expression.exec(tag);
  return match?.[1] ?? match?.[2] ?? '';
}

export function sanitizeIssueMarkdown(markdown) {
  return String(markdown ?? '')
    .replaceAll('\r\n', '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const source = imageAttribute(tag, 'src');
      const allowed =
        source.startsWith('https://github.com/user-attachments/') ||
        source.startsWith('https://user-images.githubusercontent.com/');
      if (!allowed) return '';

      const alt = imageAttribute(tag, 'alt').replace(/[[\]]/g, '').trim() || 'Test screenshot';
      return `![${alt}](${source})`;
    })
    .replace(/<[^>]+>/g, '')
    .replace(/\]\(\s*javascript:[^)]+\)/gi, '](#)')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
  );
}

export function normalizeReport(issue, games) {
  const sections = parseIssueForm(issue.body);
  const warnings = [];
  const titleId = sectionValue(sections, 'Title ID').toUpperCase();
  const status = sectionValue(sections, 'Compatibility status').toLowerCase();
  const testedVersion = sectionValue(
    sections,
    'SharpEmu build (commit or release, not the game version)',
    'SharpEmu version (commit or release)',
  );
  let testedDate = sectionValue(sections, 'Test date');
  const gameVersion = sectionValue(sections, 'Game version');
  const os = sectionValue(sections, 'Operating system').toLowerCase();
  const hardware = sectionValue(sections, 'Hardware (CPU / GPU)');
  const notes = sanitizeIssueMarkdown(sectionValue(sections, 'What works / what breaks'));
  const ownership = sectionValue(sections, 'Testing confirmation');

  if (!/^PPSA\d{5}$/.test(titleId)) {
    throw new Error(`Issue #${issue.number}: invalid Title ID "${titleId}".`);
  }
  if (!STATUSES.has(status)) {
    throw new Error(`Issue #${issue.number}: invalid compatibility status "${status}".`);
  }
  if (!testedVersion) {
    throw new Error(`Issue #${issue.number}: missing SharpEmu build.`);
  }
  if (!testedDate) {
    testedDate = String(issue.createdAt ?? '').slice(0, 10);
    warnings.push(`Test date was missing; using the issue creation date (${testedDate}).`);
  }
  if (!validDate(testedDate)) {
    throw new Error(`Issue #${issue.number}: invalid test date "${testedDate}".`);
  }
  if (!OPERATING_SYSTEMS.has(os)) {
    throw new Error(`Issue #${issue.number}: invalid operating system "${os}".`);
  }
  if (!notes) {
    throw new Error(`Issue #${issue.number}: missing compatibility notes or evidence.`);
  }
  if (ownership && !/\[[xX]\]/.test(ownership)) {
    throw new Error(`Issue #${issue.number}: testing ownership was not confirmed.`);
  }
  if (!ownership) {
    warnings.push('Legacy issue has no ownership checkbox; maintainer approval is required.');
  }

  const game = games.find((candidate) =>
    (candidate.allTitleIds ?? [candidate.titleId]).includes(titleId),
  );
  if (!game) {
    throw new Error(`Issue #${issue.number}: Title ID ${titleId} is not in the game catalog.`);
  }

  return {
    issue: {
      number: issue.number,
      url: issue.url,
    },
    game,
    titleId,
    status,
    testedVersion,
    testedDate,
    gameVersion: gameVersion || undefined,
    os,
    hardware: hardware || undefined,
    notes,
    warnings,
  };
}

export function chooseReportTarget(report, existingFileNames = []) {
  const existingByUppercase = new Map(
    existingFileNames.map((fileName) => [fileName.toUpperCase(), fileName]),
  );
  const aliases = report.game.allTitleIds ?? [report.game.titleId];

  for (const titleId of aliases) {
    const existing = existingByUppercase.get(`${titleId}.MD`);
    if (existing) {
      return {
        fileName: existing,
        titleId: path.basename(existing, path.extname(existing)).toUpperCase(),
        updating: true,
      };
    }
  }

  return {
    fileName: `${report.titleId}.md`,
    titleId: report.titleId,
    updating: false,
  };
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

export function manualReportOptions(markdown) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(String(markdown))?.[1] ?? '';
  return {
    commentsDisabled: /^commentsDisabled:[ \t]*true[ \t]*(?:#.*)?$/m.test(frontmatter),
  };
}

export function renderReport(report, targetTitleId = report.titleId, options = {}) {
  const frontmatter = [
    '---',
    `titleId: ${yamlString(targetTitleId)}`,
    `status: ${yamlString(report.status)}`,
    `testedVersion: ${yamlString(report.testedVersion)}`,
    `testedDate: ${yamlString(report.testedDate)}`,
    ...(report.gameVersion ? [`gameVersion: ${yamlString(report.gameVersion)}`] : []),
    `os: ${yamlString(report.os)}`,
    ...(report.hardware ? [`hardware: ${yamlString(report.hardware)}`] : []),
    ...(options.commentsDisabled ? ['commentsDisabled: true'] : []),
    '---',
  ];

  return `${frontmatter.join('\n')}\n\n${report.notes}\n\n> Source: [GitHub compatibility report #${report.issue.number}](${report.issue.url})\n`;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const issueNumber = Number(argument('--issue'));
  const repository = argument('--repo') ?? process.env.GITHUB_REPOSITORY;
  if (!Number.isSafeInteger(issueNumber) || issueNumber <= 0) {
    throw new Error('--issue must be a positive integer.');
  }
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error('--repo or GITHUB_REPOSITORY must be owner/name.');
  }

  const issue = JSON.parse(
    execFileSync(
      'gh',
      [
        'issue',
        'view',
        String(issueNumber),
        '--repo',
        repository,
        '--json',
        'number,title,body,url,createdAt,state',
      ],
      { encoding: 'utf8' },
    ),
  );
  if (issue.state !== 'OPEN') {
    throw new Error(`Issue #${issueNumber} is not open.`);
  }

  const root = process.cwd();
  const games = JSON.parse(
    await readFile(path.join(root, 'src/data/games.json'), 'utf8'),
  );
  const report = normalizeReport(issue, games);
  const compatibilityDirectory = path.join(root, 'src/content/compat');
  await mkdir(compatibilityDirectory, { recursive: true });
  const existingFileNames = await readdir(compatibilityDirectory);
  const target = chooseReportTarget(report, existingFileNames);
  const reportPath = path.join(compatibilityDirectory, target.fileName);
  const manualOptions = target.updating
    ? manualReportOptions(await readFile(reportPath, 'utf8'))
    : {};
  await writeFile(reportPath, renderReport(report, target.titleId, manualOptions), 'utf8');

  const relativePath = path.relative(root, reportPath).split(path.sep).join('/');
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `report_path=${relativePath}\nwarning_count=${report.warnings.length}\n`,
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = [
      `### Compatibility report #${issueNumber}`,
      '',
      `Generated \`${relativePath}\` for **${report.game.name}**.`,
      '',
      ...report.warnings.map((warning) => `- ⚠️ ${warning}`),
      '',
    ];
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary.join('\n'));
  }

  console.log(
    `${target.updating ? 'Updated' : 'Created'} ${relativePath} from issue #${issueNumber}.`,
  );
  for (const warning of report.warnings) console.warn(`Warning: ${warning}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
