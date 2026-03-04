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
});
