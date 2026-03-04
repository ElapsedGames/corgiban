import { describe, expect, it } from 'vitest';

import { analyzeAll, analyzeFile } from '../analyzeFiles';

describe('analyzeFiles', () => {
  // analyzeFile is a stub: real line counting, size classification, and time-usage
  // detection are not yet implemented. Add tests here when the implementation lands.
  it.todo('counts lines in a real file');
  it.todo('classifies file size as W (warning) when over 300 lines');
  it.todo('classifies file size as F (fail) when over 550 lines');
  it.todo('detects Date.now() usage as hasTimeUsage: true');

  it('sorts records by path', () => {
    const records = analyzeAll(['b.ts', 'a.ts'], 'root');
    expect(records.map((record) => record.path)).toEqual(['a.ts', 'b.ts']);
  });
});
