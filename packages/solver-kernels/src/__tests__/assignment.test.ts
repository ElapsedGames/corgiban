import { describe, expect, it } from 'vitest';

import { assignmentHeuristic } from '../assignment';

describe('assignmentHeuristic', () => {
  it('computes minimum assignment cost', () => {
    const result = assignmentHeuristic({
      costs: [
        [4, 1, 3],
        [2, 0, 5],
        [3, 2, 2],
      ],
    });

    expect(result).toBe(5);
  });

  it('returns zero for an empty assignment matrix', () => {
    expect(assignmentHeuristic({ costs: [] })).toBe(0);
  });

  it('supports rectangular matrices with extra columns', () => {
    const result = assignmentHeuristic({
      costs: [
        [9, 2, 7, 8],
        [6, 4, 3, 7],
        [5, 8, 1, 8],
      ],
    });

    expect(result).toBe(9);
  });

  it('rejects inconsistent row lengths and non-finite costs', () => {
    expect(() => assignmentHeuristic({ costs: [[1, 2], [3]] })).toThrow(
      'Assignment matrix row 2 has inconsistent length.',
    );
    expect(() => assignmentHeuristic({ costs: [[Number.POSITIVE_INFINITY]] })).toThrow(
      'Assignment matrix contains invalid cost at [0, 0].',
    );
  });

  it('rejects invalid matrices', () => {
    expect(() => assignmentHeuristic({ costs: [[1], [2]] })).toThrow('at least one column');
    expect(() => assignmentHeuristic({ costs: [[1, -1]] })).toThrow('invalid cost');
  });
});
