import path from 'node:path';

export type CoverageMetricSummary = {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
};

export type CoverageFileSummary = {
  path: string;
  statements: CoverageMetricSummary;
  branches: CoverageMetricSummary;
  functions: CoverageMetricSummary;
  lines: CoverageMetricSummary;
  uncoveredLines: string;
};

export type CoverageBucket = 'full' | 'near' | 'pass' | 'hotspot';

export type CoveragePackageSummary = {
  packagePath: string;
  fullCount: number;
  nearCount: number;
  passCount: number;
  hotspotCount: number;
  statements: CoverageMetricSummary;
  branches: CoverageMetricSummary;
  functions: CoverageMetricSummary;
  lines: CoverageMetricSummary;
};

export type CoverageHotspot = {
  path: string;
  statementsPct: number;
  branchesPct: number;
  functionsPct: number;
  linesPct: number;
};

type CoverageLocation = {
  line: number;
  column: number;
};

type CoverageRange = {
  start: CoverageLocation;
  end: CoverageLocation;
};

type CoverageFileRecord = {
  path: string;
  statementMap: Record<string, CoverageRange>;
  fnMap: Record<string, unknown>;
  branchMap: Record<string, { locations?: CoverageRange[] }>;
  s: Record<string, number>;
  f: Record<string, number>;
  b: Record<string, number[]>;
};

type CoverageFinalJson = Record<string, CoverageFileRecord>;

type CoverageTreeNode = {
  fullPath: string;
  segment: string;
  children: Map<string, CoverageTreeNode>;
  hotspotFile?: CoverageFileSummary;
};

type CoverageTableRow = {
  fileLabel: string;
  statementsPct: string;
  branchesPct: string;
  functionsPct: string;
  linesPct: string;
  uncoveredText: string;
};

const NEAR_THRESHOLD = 95;
const PASS_STATEMENTS_THRESHOLD = 97;
const PASS_METRIC_THRESHOLD = 80;
const HIGH_WATERMARK = 95;
const MEDIUM_WATERMARK = 80;
const LOW_WATERMARK = 50;
const ANSI_RESET = '\u001B[0m';
const ANSI_GREEN = '\u001B[32m';
const ANSI_YELLOW = '\u001B[93m';
const ANSI_RED = '\u001B[31m';
const ANSI_ORANGE = '\u001B[38;5;214m';
const ANSI_BLUE = '\u001B[34m';
const ANSI_DIM = '\u001B[2m';
const ANSI_PATTERN = /\u001B\[[0-9;]*m/g;

function formatPct(value: number): string {
  return value.toFixed(2);
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll('\\', '/');
}

function toRelativePath(root: string, filePath: string): string {
  return normalizePath(path.relative(root, filePath));
}

function toPackagePath(filePath: string): string {
  const segments = filePath.split('/');

  if (segments[0] === 'apps' && segments.length >= 2) {
    return `${segments[0]}/${segments[1]}`;
  }

  if (segments[0] === 'packages' && segments.length >= 2) {
    return `${segments[0]}/${segments[1]}`;
  }

  if (segments[0] === 'tools') {
    return 'tools';
  }

  return segments[0] ?? filePath;
}

function toPct(covered: number, total: number): number {
  if (total === 0) {
    return 100;
  }

  return Number(((covered / total) * 100).toFixed(2));
}

function summarizeCounter(counter: Record<string, number>): CoverageMetricSummary {
  const values = Object.values(counter);
  const total = values.length;
  const covered = values.filter((value) => value > 0).length;

  return {
    total,
    covered,
    skipped: 0,
    pct: toPct(covered, total),
  };
}

function summarizeBranches(counter: Record<string, number[]>): CoverageMetricSummary {
  const values = Object.values(counter).flat();
  const total = values.length;
  const covered = values.filter((value) => value > 0).length;

  return {
    total,
    covered,
    skipped: 0,
    pct: toPct(covered, total),
  };
}

function summarizeLines(
  statementMap: Record<string, CoverageRange>,
  statementCounts: Record<string, number>,
): CoverageMetricSummary {
  const lineCounts = new Map<number, number>();

  Object.entries(statementMap).forEach(([statementId, range]) => {
    const line = range.start.line;
    const current = lineCounts.get(line) ?? 0;
    lineCounts.set(line, Math.max(current, statementCounts[statementId] ?? 0));
  });

  const values = Array.from(lineCounts.values());
  const total = values.length;
  const covered = values.filter((value) => value > 0).length;

  return {
    total,
    covered,
    skipped: 0,
    pct: toPct(covered, total),
  };
}

function collectUncoveredLines(
  statementMap: Record<string, CoverageRange>,
  statementCounts: Record<string, number>,
): string {
  const uncoveredLines = Array.from(
    new Set(
      Object.entries(statementMap)
        .filter(([statementId]) => (statementCounts[statementId] ?? 0) === 0)
        .map(([, range]) => range.start.line),
    ),
  ).sort((left, right) => left - right);

  if (uncoveredLines.length === 0) {
    return '';
  }

  const ranges: string[] = [];
  let rangeStart = uncoveredLines[0];
  let previous = uncoveredLines[0];

  for (let index = 1; index < uncoveredLines.length; index += 1) {
    const current = uncoveredLines[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }

    ranges.push(rangeStart === previous ? String(rangeStart) : `${rangeStart}-${previous}`);
    rangeStart = current;
    previous = current;
  }

  ranges.push(rangeStart === previous ? String(rangeStart) : `${rangeStart}-${previous}`);
  return ranges.join(',');
}

function summarizeCoverageRecord(
  root: string,
  filePath: string,
  record: CoverageFileRecord,
): CoverageFileSummary {
  return {
    path: toRelativePath(root, filePath),
    statements: summarizeCounter(record.s),
    branches: summarizeBranches(record.b),
    functions: summarizeCounter(record.f),
    lines: summarizeLines(record.statementMap, record.s),
    uncoveredLines: collectUncoveredLines(record.statementMap, record.s),
  };
}

function combineMetricSummaries(summaries: CoverageMetricSummary[]): CoverageMetricSummary {
  const total = summaries.reduce((sum, summary) => sum + summary.total, 0);
  const covered = summaries.reduce((sum, summary) => sum + summary.covered, 0);
  const skipped = summaries.reduce((sum, summary) => sum + summary.skipped, 0);

  return {
    total,
    covered,
    skipped,
    pct: toPct(covered, total),
  };
}

function combineCoverageFiles(
  pathLabel: string,
  files: CoverageFileSummary[],
): CoverageFileSummary {
  return {
    path: pathLabel,
    statements: combineMetricSummaries(files.map((file) => file.statements)),
    branches: combineMetricSummaries(files.map((file) => file.branches)),
    functions: combineMetricSummaries(files.map((file) => file.functions)),
    lines: combineMetricSummaries(files.map((file) => file.lines)),
    uncoveredLines: '',
  };
}

function isFullCoverage(summary: CoverageFileSummary): boolean {
  return (
    summary.statements.pct === 100 &&
    summary.branches.pct === 100 &&
    summary.functions.pct === 100 &&
    summary.lines.pct === 100
  );
}

function isNearCoverage(summary: CoverageFileSummary): boolean {
  return (
    summary.statements.pct >= NEAR_THRESHOLD &&
    summary.branches.pct >= NEAR_THRESHOLD &&
    summary.functions.pct >= NEAR_THRESHOLD &&
    summary.lines.pct >= NEAR_THRESHOLD
  );
}

function classifyCoverage(summary: CoverageFileSummary): CoverageBucket {
  if (isFullCoverage(summary)) {
    return 'full';
  }

  if (isNearCoverage(summary)) {
    return 'near';
  }

  if (isPassCoverage(summary)) {
    return 'pass';
  }

  return 'hotspot';
}

function hasSevereMetric(summary: CoverageFileSummary): boolean {
  return (
    summary.branches.pct < PASS_METRIC_THRESHOLD ||
    summary.functions.pct < PASS_METRIC_THRESHOLD ||
    summary.lines.pct < PASS_METRIC_THRESHOLD
  );
}

function isPassCoverage(summary: CoverageFileSummary): boolean {
  return summary.statements.pct >= PASS_STATEMENTS_THRESHOLD && !hasSevereMetric(summary);
}

function shouldDisplayHotspot(summary: CoverageFileSummary): boolean {
  return !isPassCoverage(summary);
}

export function parseCoverageFinal(
  coverageJson: CoverageFinalJson,
  root: string,
): {
  total: CoverageFileSummary;
  files: CoverageFileSummary[];
} {
  const files = Object.entries(coverageJson)
    .map(([filePath, record]) => summarizeCoverageRecord(root, filePath, record))
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    total: combineCoverageFiles('All files', files),
    files,
  };
}

export function summarizeCoveragePackages(files: CoverageFileSummary[]): CoveragePackageSummary[] {
  const packageFiles = new Map<string, CoverageFileSummary[]>();

  files.forEach((file) => {
    const packagePath = toPackagePath(file.path);
    const current = packageFiles.get(packagePath) ?? [];
    current.push(file);
    packageFiles.set(packagePath, current);
  });

  return Array.from(packageFiles.entries())
    .map(([packagePath, packageCoverageFiles]) => {
      const aggregate = combineCoverageFiles(packagePath, packageCoverageFiles);
      const bucketCounts = packageCoverageFiles.reduce(
        (counts, file) => {
          const bucket = classifyCoverage(file);
          if (bucket === 'full') {
            counts.fullCount += 1;
          } else if (bucket === 'near') {
            counts.nearCount += 1;
          } else if (bucket === 'pass') {
            counts.passCount += 1;
          } else {
            counts.hotspotCount += 1;
          }
          return counts;
        },
        { fullCount: 0, nearCount: 0, passCount: 0, hotspotCount: 0 },
      );

      return {
        packagePath,
        fullCount: bucketCounts.fullCount,
        nearCount: bucketCounts.nearCount,
        passCount: bucketCounts.passCount,
        hotspotCount: bucketCounts.hotspotCount,
        statements: aggregate.statements,
        branches: aggregate.branches,
        functions: aggregate.functions,
        lines: aggregate.lines,
      };
    })
    .sort((left, right) => left.packagePath.localeCompare(right.packagePath));
}

export function collectCoverageHotspots(files: CoverageFileSummary[]): CoverageHotspot[] {
  return files
    .filter((file) => classifyCoverage(file) === 'hotspot')
    .map((file) => ({
      path: file.path,
      statementsPct: file.statements.pct,
      branchesPct: file.branches.pct,
      functionsPct: file.functions.pct,
      linesPct: file.lines.pct,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function formatBucketCounts(fullCount: number, nearCount: number, passCount: number): string {
  return `100%=${fullCount} 95%+=${nearCount} pass=${passCount}`;
}

function buildCoverageTree(packagePath: string, hotspots: CoverageFileSummary[]): CoverageTreeNode {
  const root: CoverageTreeNode = {
    fullPath: packagePath,
    segment: packagePath,
    children: new Map<string, CoverageTreeNode>(),
  };
  const packageSegments = packagePath.split('/');

  hotspots.forEach((hotspot) => {
    const segments = hotspot.path.split('/').slice(packageSegments.length);
    let currentNode = root;
    let currentPath = packagePath;

    segments.forEach((segment, index) => {
      currentPath = `${currentPath}/${segment}`;
      const existingChild = currentNode.children.get(segment) ?? {
        fullPath: currentPath,
        segment,
        children: new Map<string, CoverageTreeNode>(),
      };

      currentNode.children.set(segment, existingChild);
      currentNode = existingChild;

      if (index === segments.length - 1) {
        currentNode.hotspotFile = hotspot;
      }
    });
  });

  return root;
}

function findFilesInSubtree(
  files: CoverageFileSummary[],
  subtreePath: string,
): CoverageFileSummary[] {
  return files.filter(
    (file) => file.path === subtreePath || file.path.startsWith(`${subtreePath}/`),
  );
}

function renderCoverageTreeRows(
  node: CoverageTreeNode,
  packageFiles: CoverageFileSummary[],
  depth: number,
): CoverageTableRow[] {
  const rows: CoverageTableRow[] = [];
  const sortedChildren = Array.from(node.children.values()).sort((left, right) =>
    left.segment.localeCompare(right.segment),
  );

  sortedChildren.forEach((child) => {
    if (child.hotspotFile) {
      rows.push(
        toCoverageTableRow(
          `${'  '.repeat(depth)}${child.segment}`,
          child.hotspotFile,
          child.hotspotFile.uncoveredLines,
        ),
      );
      return;
    }

    const subtreeSummary = combineCoverageFiles(
      child.fullPath,
      findFilesInSubtree(packageFiles, child.fullPath),
    );
    rows.push(toCoverageTableRow(`${'  '.repeat(depth)}${child.segment}`, subtreeSummary, ''));
    rows.push(...renderCoverageTreeRows(child, packageFiles, depth + 1));
  });

  return rows;
}

function toCoverageTableRow(
  fileLabel: string,
  summary: CoverageFileSummary,
  uncoveredText: string,
): CoverageTableRow {
  return {
    fileLabel,
    statementsPct: formatPct(summary.statements.pct),
    branchesPct: formatPct(summary.branches.pct),
    functionsPct: formatPct(summary.functions.pct),
    linesPct: formatPct(summary.lines.pct),
    uncoveredText,
  };
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '');
}

function padVisibleRight(value: string, width: number): string {
  const visibleWidth = stripAnsi(value).length;
  return `${value}${' '.repeat(Math.max(0, width - visibleWidth))}`;
}

function padVisibleLeft(value: string, width: number): string {
  const visibleWidth = stripAnsi(value).length;
  return `${' '.repeat(Math.max(0, width - visibleWidth))}${value}`;
}

function colorize(value: string, color: string): string {
  return `${color}${value}${ANSI_RESET}`;
}

function colorizeCoveragePct(value: string): string {
  const numericValue = Number(value);

  if (numericValue >= HIGH_WATERMARK) {
    return colorize(value, ANSI_GREEN);
  }

  if (numericValue >= MEDIUM_WATERMARK) {
    return colorize(value, ANSI_YELLOW);
  }

  if (numericValue >= LOW_WATERMARK) {
    return colorize(value, ANSI_ORANGE);
  }

  return colorize(value, ANSI_RED);
}

function colorizeFileLabel(value: string): string {
  return colorize(value, ANSI_GREEN);
}

function colorizeUncoveredText(value: string): string {
  if (value.length === 0) {
    return value;
  }

  if (value.startsWith('100%=')) {
    return colorize(value, ANSI_DIM);
  }

  return colorize(value, ANSI_RED);
}

function formatCoverageTable(rows: CoverageTableRow[]): string {
  const headers = {
    fileLabel: 'File',
    statementsPct: '% Stmts',
    branchesPct: '% Branch',
    functionsPct: '% Funcs',
    linesPct: '% Lines',
    uncoveredText: 'Uncovered Line #s',
  };

  const fileWidth = Math.max(headers.fileLabel.length, ...rows.map((row) => row.fileLabel.length));
  const statementsWidth = Math.max(
    headers.statementsPct.length,
    ...rows.map((row) => row.statementsPct.length),
  );
  const branchesWidth = Math.max(
    headers.branchesPct.length,
    ...rows.map((row) => row.branchesPct.length),
  );
  const functionsWidth = Math.max(
    headers.functionsPct.length,
    ...rows.map((row) => row.functionsPct.length),
  );
  const linesWidth = Math.max(headers.linesPct.length, ...rows.map((row) => row.linesPct.length));
  const uncoveredWidth = headers.uncoveredText.length;

  const divider = [
    '-'.repeat(fileWidth),
    '-'.repeat(statementsWidth),
    '-'.repeat(branchesWidth),
    '-'.repeat(functionsWidth),
    '-'.repeat(linesWidth),
    '-'.repeat(uncoveredWidth),
  ].join('-|-');

  const renderRow = (row: CoverageTableRow): string =>
    [
      padVisibleRight(colorizeFileLabel(row.fileLabel), fileWidth),
      padVisibleLeft(colorizeCoveragePct(row.statementsPct), statementsWidth),
      padVisibleLeft(colorizeCoveragePct(row.branchesPct), branchesWidth),
      padVisibleLeft(colorizeCoveragePct(row.functionsPct), functionsWidth),
      padVisibleLeft(colorizeCoveragePct(row.linesPct), linesWidth),
      padVisibleRight(colorizeUncoveredText(row.uncoveredText), uncoveredWidth),
    ].join(' | ');

  return [
    `${colorize('%', ANSI_BLUE)} Coverage report from ${colorize('v8', ANSI_YELLOW)} ${colorize('(compact hotspot view)', ANSI_DIM)}`,
    divider,
    [
      padVisibleRight(headers.fileLabel, fileWidth),
      padVisibleLeft(headers.statementsPct, statementsWidth),
      padVisibleLeft(headers.branchesPct, branchesWidth),
      padVisibleLeft(headers.functionsPct, functionsWidth),
      padVisibleLeft(headers.linesPct, linesWidth),
      padVisibleRight(headers.uncoveredText, uncoveredWidth),
    ].join(' | '),
    divider,
    ...rows.map(renderRow),
    divider,
  ].join('\n');
}

export function formatCoverageReport(
  total: CoverageFileSummary,
  files: CoverageFileSummary[],
): string {
  const packageSummaries = summarizeCoveragePackages(files);
  const bucketTotals = packageSummaries.reduce(
    (counts, summary) => {
      counts.fullCount += summary.fullCount;
      counts.nearCount += summary.nearCount;
      counts.passCount += summary.passCount;
      counts.hotspotCount += summary.hotspotCount;
      return counts;
    },
    { fullCount: 0, nearCount: 0, passCount: 0, hotspotCount: 0 },
  );

  const rows: CoverageTableRow[] = [
    toCoverageTableRow(
      total.path,
      total,
      formatBucketCounts(bucketTotals.fullCount, bucketTotals.nearCount, bucketTotals.passCount),
    ),
  ];

  packageSummaries.forEach((summary) => {
    rows.push(
      toCoverageTableRow(
        summary.packagePath,
        {
          path: summary.packagePath,
          statements: summary.statements,
          branches: summary.branches,
          functions: summary.functions,
          lines: summary.lines,
          uncoveredLines: '',
        },
        formatBucketCounts(summary.fullCount, summary.nearCount, summary.passCount),
      ),
    );

    if (summary.hotspotCount === 0) {
      return;
    }

    const packageFiles = files.filter((file) => toPackagePath(file.path) === summary.packagePath);
    const packageHotspots = packageFiles.filter(
      (file) => classifyCoverage(file) === 'hotspot' && shouldDisplayHotspot(file),
    );
    const coverageTree = buildCoverageTree(summary.packagePath, packageHotspots);
    rows.push(...renderCoverageTreeRows(coverageTree, packageFiles, 1));
  });

  return formatCoverageTable(rows);
}
