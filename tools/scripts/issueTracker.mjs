import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(__dirname, '..', '..');
export const issuesDir = path.join(repoRoot, '.tracker', 'issues');
export const templatePath = path.join(repoRoot, '.tracker', 'templates', 'issue.md');
export const knownIssuesPath = path.join(repoRoot, 'KNOWN_ISSUES.md');
export const OPEN_STATUSES = new Set(['open', 'in-progress', 'blocked']);

function compareStrings(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function normalizeContent(content) {
  return content.replace(/\r\n/g, '\n');
}

function findFrontmatterEnd(lines) {
  if (lines[0]?.trim() !== '---') {
    throw new Error('Expected issue file to start with frontmatter');
  }

  const endIndex = lines.indexOf('---', 1);
  if (endIndex === -1) {
    throw new Error('Expected closing frontmatter delimiter');
  }

  return endIndex;
}

function serializeFrontmatterValue(value) {
  if (value === null) return 'null';
  if (value === true) return 'true';
  if (value === false) return 'false';
  return String(value);
}

function findSectionRange(lines, heading) {
  const header = `## ${heading}`;
  const headerIndex = lines.findIndex((line) => line.trim() === header);
  if (headerIndex === -1) {
    throw new Error(`Expected section "${heading}"`);
  }

  let nextHeadingIndex = headerIndex + 1;
  while (nextHeadingIndex < lines.length && !lines[nextHeadingIndex].startsWith('## ')) {
    nextHeadingIndex += 1;
  }

  let bodyStart = headerIndex + 1;
  if (lines[bodyStart]?.trim() === '') {
    bodyStart += 1;
  }

  let bodyEnd = nextHeadingIndex;
  while (bodyEnd > bodyStart && lines[bodyEnd - 1].trim() === '') {
    bodyEnd -= 1;
  }

  return { headerIndex, bodyStart, bodyEnd, nextHeadingIndex };
}

function isPlaceholderResolution(text) {
  return text === '' || text === '(fill in when closing)';
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function issueFilePath(issueId) {
  return path.join(issuesDir, `${issueId}.md`);
}

export function parseFrontmatter(content) {
  const lines = normalizeContent(content).split('\n');
  const endIndex = findFrontmatterEnd(lines);
  const fields = {};

  for (let index = 1; index < endIndex; index += 1) {
    const line = lines[index];
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const rawValue = line.slice(colonIndex + 1).trim();
    fields[key] =
      rawValue === 'null'
        ? null
        : rawValue === 'true'
          ? true
          : rawValue === 'false'
            ? false
            : rawValue;
  }

  return fields;
}

export function updateFrontmatter(content, updates) {
  const lines = normalizeContent(content).split('\n');
  const endIndex = findFrontmatterEnd(lines);
  const pending = new Map(Object.entries(updates).filter(([, value]) => value !== undefined));

  for (let index = 1; index < endIndex; index += 1) {
    const line = lines[index];
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    if (!pending.has(key)) continue;

    lines[index] = `${key}: ${serializeFrontmatterValue(pending.get(key))}`;
    pending.delete(key);
  }

  if (pending.size > 0) {
    const additions = Array.from(pending.entries(), ([key, value]) => {
      return `${key}: ${serializeFrontmatterValue(value)}`;
    });
    lines.splice(endIndex, 0, ...additions);
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export function getSectionBody(content, heading) {
  const lines = normalizeContent(content).split('\n');
  const range = findSectionRange(lines, heading);
  return lines.slice(range.bodyStart, range.bodyEnd).join('\n').trim();
}

export function replaceSection(content, heading, body) {
  const lines = normalizeContent(content).split('\n');
  const range = findSectionRange(lines, heading);
  const before = lines.slice(0, range.headerIndex + 1);
  const after = lines.slice(range.nextHeadingIndex);

  while (after[0]?.trim() === '') {
    after.shift();
  }

  const bodyLines = body.trim() === '' ? [] : body.trimEnd().split('\n');
  const updated = [...before, ''];

  if (bodyLines.length > 0) {
    updated.push(...bodyLines);
  }

  if (after.length > 0) {
    updated.push('', ...after);
  }

  return `${updated.join('\n').trimEnd()}\n`;
}

export function closeIssueContent(content, { fixedAt, fixedBy, branch, pr, commit, resolution }) {
  const updatedFrontmatter = updateFrontmatter(content, {
    status: 'fixed',
    fixed_at: fixedAt,
    fixed_by: fixedBy,
    branch,
    pr,
    commit,
  });

  const existingResolution = getSectionBody(updatedFrontmatter, 'Resolution');
  const nextResolution =
    resolution?.trim() ||
    (isPlaceholderResolution(existingResolution)
      ? `Fixed on ${fixedAt}${fixedBy ? ` by ${fixedBy}` : ''}.`
      : existingResolution);

  return replaceSection(updatedFrontmatter, 'Resolution', nextResolution);
}

function formatOpenLine(issue) {
  const tags = [issue.type, issue.severity, issue.area];
  if (issue.regression === true) tags.push('regression');
  return `- ${issue.id} -- ${issue.title} (${tags.join(', ')})`;
}

function formatFixedLine(issue) {
  const when = issue.fixed_at ?? 'unknown date';
  const by = issue.fixed_by ? ` by ${issue.fixed_by}` : '';
  return `- ${issue.id} -- ${issue.title} -- ${when}${by}`;
}

function formatDeferredLine(issue) {
  return `- ${issue.id} -- ${issue.title} (${issue.type}, ${issue.area})`;
}

function section(heading, lines) {
  if (lines.length === 0) return '';
  return `## ${heading}\n\n${lines.join('\n')}\n`;
}

export function loadIssues(readIssueContent) {
  let files;
  try {
    files = readdirSync(issuesDir).filter((file) => file.endsWith('.md'));
  } catch {
    return [];
  }

  const issues = [];
  for (const file of files) {
    const issueContent = readIssueContent(issueFilePath(path.parse(file).name));
    const frontmatter = parseFrontmatter(issueContent);
    if (frontmatter.id) {
      issues.push(frontmatter);
    }
  }

  issues.sort((left, right) => compareStrings(String(left.id), String(right.id)));
  return issues;
}

export function buildKnownIssuesContent(issues) {
  const openHigh = issues
    .filter((issue) => OPEN_STATUSES.has(issue.status) && issue.severity === 'high')
    .map(formatOpenLine);
  const openMedium = issues
    .filter((issue) => OPEN_STATUSES.has(issue.status) && issue.severity === 'medium')
    .map(formatOpenLine);
  const openLow = issues
    .filter((issue) => OPEN_STATUSES.has(issue.status) && issue.severity === 'low')
    .map(formatOpenLine);
  const regressions = issues
    .filter((issue) => OPEN_STATUSES.has(issue.status) && issue.regression === true)
    .map(formatOpenLine);
  const deferred = issues.filter((issue) => issue.status === 'deferred').map(formatDeferredLine);
  const fixed = issues.filter((issue) => issue.status === 'fixed').map(formatFixedLine);

  const totalOpen = issues.filter((issue) => OPEN_STATUSES.has(issue.status)).length;
  const totalFixed = fixed.length;
  const totalDeferred = deferred.length;
  const stats = `${totalOpen} open, ${totalFixed} fixed, ${totalDeferred} deferred`;

  return [
    '<!-- Generated by tools/scripts/generate-known-issues.mjs -- do not hand-edit -->\n',
    '# Known Issues\n',
    `_${stats}_\n`,
    section('Open -- High Severity', openHigh),
    section('Open -- Medium Severity', openMedium),
    section('Open -- Low Severity', openLow),
    section('Regressions', regressions),
    section('Deferred', deferred),
    section('Fixed', fixed),
  ]
    .filter(Boolean)
    .join('\n');
}
