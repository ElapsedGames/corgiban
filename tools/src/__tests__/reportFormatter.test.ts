import { describe, expect, it } from 'vitest';

import { formatReport } from '../reportFormatter';

describe('formatReport', () => {
  it('includes the ISO timestamp and zero count for an empty report', () => {
    const output = formatReport([], new Date('2020-01-01T00:00:00.000Z'));
    expect(output).toContain('Generated: 2020-01-01T00:00:00.000Z');
    expect(output).toContain('Records: 0');
  });

  it('reflects the actual number of records in the count', () => {
    const records = [
      { path: 'a.ts', lines: 10, sizeStatus: 'P' as const, hasTimeUsage: false },
      { path: 'b.ts', lines: 20, sizeStatus: 'P' as const, hasTimeUsage: false },
    ];
    const output = formatReport(records, new Date('2020-06-15T12:00:00.000Z'));
    expect(output).toContain('Records: 2');
    expect(output).toContain('Generated: 2020-06-15T12:00:00.000Z');
  });

  it('includes the file path, line count, and status label for each record', () => {
    const records = [
      { path: 'src/foo.ts', lines: 42, sizeStatus: 'P' as const, hasTimeUsage: false },
    ];
    const output = formatReport(records, new Date('2021-01-01T00:00:00.000Z'));
    expect(output).toContain('src/foo.ts');
    expect(output).toContain('42 lines');
    expect(output).toContain('pass');
  });

  it('marks warn status files with the "warn" label', () => {
    const records = [
      { path: 'large.ts', lines: 350, sizeStatus: 'W' as const, hasTimeUsage: false },
    ];
    const output = formatReport(records, new Date('2021-01-01T00:00:00.000Z'));
    expect(output).toContain('warn');
  });

  it('marks fail status files with the "fail" label', () => {
    const records = [
      { path: 'huge.ts', lines: 600, sizeStatus: 'F' as const, hasTimeUsage: false },
    ];
    const output = formatReport(records, new Date('2021-01-01T00:00:00.000Z'));
    expect(output).toContain('fail');
  });

  it('appends a [time] marker for records with hasTimeUsage: true', () => {
    const records = [{ path: 'clock.ts', lines: 10, sizeStatus: 'P' as const, hasTimeUsage: true }];
    const output = formatReport(records, new Date('2021-01-01T00:00:00.000Z'));
    expect(output).toContain('[time]');
  });

  it('does not include [time] marker for records with hasTimeUsage: false', () => {
    const records = [{ path: 'pure.ts', lines: 10, sizeStatus: 'P' as const, hasTimeUsage: false }];
    const output = formatReport(records, new Date('2021-01-01T00:00:00.000Z'));
    expect(output).not.toContain('[time]');
  });

  it('falls back to raw sizeStatus value when status is not P/W/F', () => {
    const records = [{ path: 'mystery.ts', lines: 5, sizeStatus: 'X' as 'P', hasTimeUsage: false }];
    const output = formatReport(records, new Date('2021-01-01T00:00:00.000Z'));
    expect(output).toContain('X');
    expect(output).not.toContain('pass');
    expect(output).not.toContain('warn');
    expect(output).not.toContain('fail');
  });
});
