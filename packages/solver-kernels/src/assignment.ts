export type AssignmentHeuristicRequest = {
  costs: number[][];
};

export function assignmentHeuristic(request: AssignmentHeuristicRequest): number {
  const { costs } = request;
  const rowCount = costs.length;
  if (rowCount === 0) {
    return 0;
  }

  const colCount = costs[0]?.length ?? 0;
  if (colCount === 0 || colCount < rowCount) {
    throw new Error('Assignment matrix must have at least one column per row.');
  }

  costs.forEach((row, rowIndex) => {
    if (row.length !== colCount) {
      throw new Error(`Assignment matrix row ${rowIndex + 1} has inconsistent length.`);
    }
    row.forEach((value, colIndex) => {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Assignment matrix contains invalid cost at [${rowIndex}, ${colIndex}].`);
      }
    });
  });

  const cache = new Map<string, number>();

  const visit = (rowIndex: number, usedMask: bigint): number => {
    if (rowIndex >= rowCount) {
      return 0;
    }

    const cacheKey = `${rowIndex}:${usedMask.toString(16)}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    let best = Number.POSITIVE_INFINITY;
    for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
      const bit = 1n << BigInt(colIndex);
      if ((usedMask & bit) !== 0n) {
        continue;
      }

      const cost = costs[rowIndex][colIndex] + visit(rowIndex + 1, usedMask | bit);
      if (cost < best) {
        best = cost;
      }
    }

    cache.set(cacheKey, best);
    return best;
  };

  return visit(0, 0n);
}
