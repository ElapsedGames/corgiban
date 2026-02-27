import { describe, expect, it } from 'vitest';

import { analyzeAll, analyzeFile } from '../analyzeFiles';

describe('analyzeFiles', () => {
  it('returns a placeholder record', () => {
    const record = analyzeFile('path/to/file.ts', 'root');
    expect(record.path).toBe('path/to/file.ts');
    expect(record.sizeStatus).toBe('P');
    expect(record.hasTimeUsage).toBe(false);
  });

  it('sorts records by path', () => {
    const records = analyzeAll(['b.ts', 'a.ts'], 'root');
    expect(records.map((record) => record.path)).toEqual(['a.ts', 'b.ts']);
  });
});
