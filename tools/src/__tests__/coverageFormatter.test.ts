import { describe, expect, it } from 'vitest';

import {
  collectCoverageHotspots,
  formatCoverageReport,
  parseCoverageFinal,
  summarizeCoveragePackages,
} from '../coverageFormatter';

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
}

function createFileCoverage(
  absolutePath: string,
  counts: {
    statements: number[];
    functions: number[];
    branches: number[][];
  },
) {
  return {
    path: absolutePath,
    statementMap: Object.fromEntries(
      counts.statements.map((_, index) => [
        String(index),
        {
          start: { line: index + 1, column: 0 },
          end: { line: index + 1, column: 10 },
        },
      ]),
    ),
    fnMap: Object.fromEntries(
      counts.functions.map((_, index) => [
        String(index),
        {
          name: `fn${index}`,
          decl: {
            start: { line: index + 1, column: 0 },
            end: { line: index + 1, column: 10 },
          },
          loc: {
            start: { line: index + 1, column: 0 },
            end: { line: index + 1, column: 10 },
          },
          line: index + 1,
        },
      ]),
    ),
    branchMap: Object.fromEntries(
      counts.branches.map((branchCounts, index) => [
        String(index),
        {
          locations: branchCounts.map((_, locationIndex) => ({
            start: { line: index + 1, column: locationIndex },
            end: { line: index + 1, column: locationIndex + 1 },
          })),
        },
      ]),
    ),
    s: Object.fromEntries(counts.statements.map((value, index) => [String(index), value])),
    f: Object.fromEntries(counts.functions.map((value, index) => [String(index), value])),
    b: Object.fromEntries(counts.branches.map((value, index) => [String(index), value])),
  };
}

describe('coverageFormatter', () => {
  it('parses and sorts file summaries from coverage-final JSON', () => {
    const parsed = parseCoverageFinal(
      {
        'C:/repo/packages/zeta/src/file.ts': createFileCoverage(
          'C:/repo/packages/zeta/src/file.ts',
          {
            statements: [1, 1],
            functions: [1],
            branches: [[1, 1]],
          },
        ),
        'C:/repo/apps/web/app/root.tsx': createFileCoverage('C:/repo/apps/web/app/root.tsx', {
          statements: [1, 0],
          functions: [1, 1, 0],
          branches: [[1], [1], [0]],
        }),
      },
      'C:/repo',
    );

    expect(parsed.total.path).toBe('All files');
    expect(parsed.files.map((file) => file.path)).toEqual([
      'apps/web/app/root.tsx',
      'packages/zeta/src/file.ts',
    ]);
    expect(parsed.total.statements.pct).toBe(75);
    expect(parsed.files[0]?.uncoveredLines).toBe('2');
  });

  it('groups files into full, near, pass, and hotspot buckets per package', () => {
    const { files } = parseCoverageFinal(
      {
        'C:/repo/apps/web/app/full.ts': createFileCoverage('C:/repo/apps/web/app/full.ts', {
          statements: [1],
          functions: [1],
          branches: [[1]],
        }),
        'C:/repo/apps/web/app/near.ts': createFileCoverage('C:/repo/apps/web/app/near.ts', {
          statements: Array.from({ length: 100 }, (_, index) => (index === 99 ? 0 : 1)),
          functions: Array.from({ length: 100 }, (_, index) => (index < 96 ? 1 : 0)),
          branches: [Array.from({ length: 100 }, (_, index) => (index < 95 ? 1 : 0))],
        }),
        'C:/repo/apps/web/app/pass.ts': createFileCoverage('C:/repo/apps/web/app/pass.ts', {
          statements: Array.from({ length: 100 }, (_, index) => (index < 98 ? 1 : 0)),
          functions: Array.from({ length: 100 }, (_, index) => (index < 85 ? 1 : 0)),
          branches: [Array.from({ length: 100 }, (_, index) => (index < 85 ? 1 : 0))],
        }),
        'C:/repo/apps/web/app/hot.ts': createFileCoverage('C:/repo/apps/web/app/hot.ts', {
          statements: Array.from({ length: 100 }, (_, index) => (index < 94 ? 1 : 0)),
          functions: Array.from({ length: 100 }, (_, index) => (index < 99 ? 1 : 0)),
          branches: [Array.from({ length: 100 }, (_, index) => (index < 99 ? 1 : 0))],
        }),
        'C:/repo/tools/src/hot.ts': createFileCoverage('C:/repo/tools/src/hot.ts', {
          statements: Array.from({ length: 100 }, (_, index) => (index < 93 ? 1 : 0)),
          functions: Array.from({ length: 100 }, (_, index) => (index < 91 ? 1 : 0)),
          branches: [Array.from({ length: 100 }, (_, index) => (index < 92 ? 1 : 0))],
        }),
      },
      'C:/repo',
    );

    expect(summarizeCoveragePackages(files)).toEqual([
      {
        packagePath: 'apps/web',
        fullCount: 1,
        nearCount: 1,
        passCount: 1,
        hotspotCount: 1,
        statements: { total: 301, covered: 292, skipped: 0, pct: 97.01 },
        branches: { total: 301, covered: 280, skipped: 0, pct: 93.02 },
        functions: { total: 301, covered: 281, skipped: 0, pct: 93.36 },
        lines: { total: 301, covered: 292, skipped: 0, pct: 97.01 },
      },
      {
        packagePath: 'tools',
        fullCount: 0,
        nearCount: 0,
        passCount: 0,
        hotspotCount: 1,
        statements: { total: 100, covered: 93, skipped: 0, pct: 93 },
        branches: { total: 100, covered: 92, skipped: 0, pct: 92 },
        functions: { total: 100, covered: 91, skipped: 0, pct: 91 },
        lines: { total: 100, covered: 93, skipped: 0, pct: 93 },
      },
    ]);
  });

  it('treats a file as a hotspot when any metric falls below the pass bar', () => {
    const { files } = parseCoverageFinal(
      {
        'C:/repo/packages/core/src/almost.ts': createFileCoverage(
          'C:/repo/packages/core/src/almost.ts',
          {
            statements: Array.from({ length: 100 }, (_, index) => (index < 98 ? 1 : 0)),
            functions: [1],
            branches: [Array.from({ length: 100 }, (_, index) => (index < 79 ? 1 : 0))],
          },
        ),
      },
      'C:/repo',
    );

    expect(collectCoverageHotspots(files)).toEqual([
      {
        path: 'packages/core/src/almost.ts',
        statementsPct: 98,
        branchesPct: 79,
        functionsPct: 100,
        linesPct: 98,
      },
    ]);
  });

  it('formats a stable report with package summaries and hotspot rows', () => {
    const parsed = parseCoverageFinal(
      {
        'C:/repo/apps/web/app/full.ts': createFileCoverage('C:/repo/apps/web/app/full.ts', {
          statements: [1],
          functions: [1],
          branches: [[1]],
        }),
        'C:/repo/apps/web/app/root.tsx': createFileCoverage('C:/repo/apps/web/app/root.tsx', {
          statements: [1, 0],
          functions: [1, 0],
          branches: [[1]],
        }),
        'C:/repo/apps/web/app/mild.ts': createFileCoverage('C:/repo/apps/web/app/mild.ts', {
          statements: Array.from({ length: 100 }, (_, index) => (index < 98 ? 1 : 0)),
          functions: [1],
          branches: [Array.from({ length: 100 }, (_, index) => (index < 90 ? 1 : 0))],
        }),
        'C:/repo/packages/core/src/near.ts': createFileCoverage(
          'C:/repo/packages/core/src/near.ts',
          {
            statements: Array.from({ length: 100 }, (_, index) => (index === 99 ? 0 : 1)),
            functions: Array.from({ length: 100 }, (_, index) => (index < 98 ? 1 : 0)),
            branches: [Array.from({ length: 100 }, (_, index) => (index < 97 ? 1 : 0))],
          },
        ),
      },
      'C:/repo',
    );

    const report = formatCoverageReport(parsed.total, parsed.files);
    const plainReport = stripAnsi(report);

    expect(plainReport).toContain('% Coverage report from v8 (compact hotspot view)');
    expect(plainReport).toContain('File');
    expect(plainReport).toContain('All files');
    expect(plainReport).toContain('apps/web');
    expect(plainReport).toContain('100%=1 95%+=0 pass=1');
    expect(plainReport).toContain('packages/core');
    expect(plainReport).toContain('100%=0 95%+=1 pass=0');
    expect(plainReport).toContain('  app');
    expect(plainReport).toContain('    root.tsx');
    expect(plainReport).toContain('50.00');
    expect(plainReport).toContain('2');
    expect(plainReport).not.toContain('mild.ts');
    expect(report).toContain('\u001B[32m');
    expect(report).toContain('\u001B[31m');
    expect(report).toContain('\u001B[93m');
    expect(report).toContain('\u001B[38;5;214m');
  });

  it('omits nested hotspot rows when every file is at least 95 percent across all metrics', () => {
    const parsed = parseCoverageFinal(
      Object.fromEntries([
        [
          'C:/repo/packages/core/src/full.ts',
          createFileCoverage('C:/repo/packages/core/src/full.ts', {
            statements: [1],
            functions: [1],
            branches: [[1]],
          }),
        ],
        [
          'C:/repo/packages/solver/src/near.ts',
          createFileCoverage('C:/repo/packages/solver/src/near.ts', {
            statements: Array.from({ length: 100 }, (_, index) => (index === 99 ? 0 : 1)),
            functions: Array.from({ length: 100 }, (_, index) => (index < 96 ? 1 : 0)),
            branches: [Array.from({ length: 100 }, (_, index) => (index < 95 ? 1 : 0))],
          }),
        ],
      ]),
      'C:/repo',
    );

    const report = formatCoverageReport(parsed.total, parsed.files);
    const plainReport = stripAnsi(report);

    expect(plainReport).toContain('packages/core');
    expect(plainReport).toContain('packages/solver');
    expect(plainReport).not.toContain('  src');
    expect(plainReport).not.toContain('near.ts');
  });

  it('counts pass files without listing them as hotspots', () => {
    const parsed = parseCoverageFinal(
      {
        'C:/repo/packages/solver/src/mild.ts': createFileCoverage(
          'C:/repo/packages/solver/src/mild.ts',
          {
            statements: Array.from({ length: 100 }, (_, index) => (index < 98 ? 1 : 0)),
            functions: [1],
            branches: [Array.from({ length: 100 }, (_, index) => (index < 94 ? 1 : 0))],
          },
        ),
      },
      'C:/repo',
    );

    const packageSummary = summarizeCoveragePackages(parsed.files);
    const plainReport = stripAnsi(formatCoverageReport(parsed.total, parsed.files));

    expect(packageSummary).toEqual([
      {
        packagePath: 'packages/solver',
        fullCount: 0,
        nearCount: 0,
        passCount: 1,
        hotspotCount: 0,
        statements: { total: 100, covered: 98, skipped: 0, pct: 98 },
        branches: { total: 100, covered: 94, skipped: 0, pct: 94 },
        functions: { total: 1, covered: 1, skipped: 0, pct: 100 },
        lines: { total: 100, covered: 98, skipped: 0, pct: 98 },
      },
    ]);
    expect(plainReport).toContain('100%=0 95%+=0 pass=1');
    expect(plainReport).not.toContain('mild.ts');
  });

  it('uses four color bands for coverage percentages', () => {
    const parsed = parseCoverageFinal(
      {
        'C:/repo/apps/web/app/green.ts': createFileCoverage('C:/repo/apps/web/app/green.ts', {
          statements: Array.from({ length: 100 }, (_, index) => (index < 96 ? 1 : 0)),
          functions: [1],
          branches: [Array.from({ length: 100 }, (_, index) => (index < 95 ? 1 : 0))],
        }),
        'C:/repo/apps/web/app/yellow.ts': createFileCoverage('C:/repo/apps/web/app/yellow.ts', {
          statements: Array.from({ length: 100 }, (_, index) => (index < 90 ? 1 : 0)),
          functions: [1],
          branches: [Array.from({ length: 100 }, (_, index) => (index < 90 ? 1 : 0))],
        }),
        'C:/repo/apps/web/app/orange.ts': createFileCoverage('C:/repo/apps/web/app/orange.ts', {
          statements: Array.from({ length: 100 }, (_, index) => (index < 60 ? 1 : 0)),
          functions: [1],
          branches: [Array.from({ length: 100 }, (_, index) => (index < 60 ? 1 : 0))],
        }),
        'C:/repo/apps/web/app/red.ts': createFileCoverage('C:/repo/apps/web/app/red.ts', {
          statements: Array.from({ length: 100 }, (_, index) => (index < 40 ? 1 : 0)),
          functions: [1],
          branches: [Array.from({ length: 100 }, (_, index) => (index < 40 ? 1 : 0))],
        }),
      },
      'C:/repo',
    );

    const report = formatCoverageReport(parsed.total, parsed.files);

    expect(report).toContain('\u001B[32m');
    expect(report).toContain('\u001B[93m');
    expect(report).toContain('\u001B[38;5;214m');
    expect(report).toContain('\u001B[31m');
  });
});
