import { describe, expect, it } from 'vitest';

import { formatReport } from '../reportFormatter';

describe('formatReport', () => {
  it('includes timestamp and record count', () => {
    const output = formatReport([], new Date('2020-01-01T00:00:00.000Z'));
    expect(output).toContain('Generated: 2020-01-01T00:00:00.000Z');
    expect(output).toContain('Records: 0');
  });
});
