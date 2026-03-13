import { describe, expect, it } from 'vitest';

import { formatReport } from '../reportFormatter';

describe('formatReport', () => {
  it('includes the ISO timestamp and zero count for an empty report', () => {
    const output = formatReport([], new Date('2020-01-01T00:00:00.000Z'));
    expect(output).toContain('# Best Practices Report');
    expect(output).toContain('Generated: 2020-01-01T00:00:00.000Z');
    expect(output).toContain('Scanned files: 0');
    expect(output).toContain('Warning-sized files (501-800 lines): 0');
    expect(output).toContain('Fail-sized files (>800 lines): 0');
  });

  it('reflects the actual number of records in the summary count', () => {
    const records = [
      { path: 'a.ts', lines: 10, sizeStatus: 'P' as const, hasTimeUsage: false },
      { path: 'b.ts', lines: 20, sizeStatus: 'P' as const, hasTimeUsage: false },
    ];
    const output = formatReport(records, new Date('2020-06-15T12:00:00.000Z'));
    expect(output).toContain('Scanned files: 2');
    expect(output).toContain('Generated: 2020-06-15T12:00:00.000Z');
  });

  it('includes warning and failing files in the correct sections', () => {
    const records = [
      { path: 'src/warn.ts', lines: 620, sizeStatus: 'W' as const, hasTimeUsage: false },
      { path: 'src/fail.ts', lines: 900, sizeStatus: 'F' as const, hasTimeUsage: false },
    ];
    const output = formatReport(records, new Date('2021-01-01T00:00:00.000Z'));
    expect(output).toContain('Warning-sized files (501-800 lines): 1');
    expect(output).toContain('src/warn.ts (620 lines)');
    expect(output).toContain('Fail-sized files (>800 lines): 1');
    expect(output).toContain('src/fail.ts (900 lines)');
  });

  it('lists time-usage findings in the informational summary', () => {
    const records = [{ path: 'clock.ts', lines: 10, sizeStatus: 'P' as const, hasTimeUsage: true }];
    const output = formatReport(records, new Date('2021-01-01T00:00:00.000Z'));
    expect(output).toContain('## Time Usage Summary');
    expect(output).toContain('clock.ts');
  });

  it('shows empty sections as None when there are no matching records', () => {
    const records = [{ path: 'pure.ts', lines: 10, sizeStatus: 'P' as const, hasTimeUsage: false }];
    const output = formatReport(records, new Date('2021-01-01T00:00:00.000Z'));
    expect(output).toContain('Warning-sized files (501-800 lines): 0');
    expect(output).toContain('Fail-sized files (>800 lines): 0');
    expect(output).toContain('## Time Usage Summary');
    expect(output).toContain('- None');
  });
});
