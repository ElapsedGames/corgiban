import type { CompiledLevel } from '../state/compiledLevel';

const IMPOSSIBLE_ASSIGNMENT_COST = 1_000_000;

function buildCostMatrix(compiled: CompiledLevel, boxes: Uint16Array): number[][] {
  const boxCount = boxes.length;
  const goalCount = compiled.goalDistances.length;

  if (boxCount === 0 || goalCount === 0) {
    return [];
  }

  if (goalCount < boxCount) {
    return Array.from({ length: boxCount }, () =>
      Array.from({ length: boxCount }, () => IMPOSSIBLE_ASSIGNMENT_COST),
    );
  }

  return Array.from({ length: boxCount }, (_, rowIndex) =>
    Array.from({ length: goalCount }, (_, colIndex) => {
      const rawDistance = compiled.goalDistances[colIndex]?.[boxes[rowIndex]] ?? 0xffff;
      return rawDistance === 0xffff ? IMPOSSIBLE_ASSIGNMENT_COST : rawDistance;
    }),
  );
}

function solveHungarian(costs: number[][]): number {
  const rowCount = costs.length;
  if (rowCount === 0) {
    return 0;
  }

  const columnCount = costs[0]?.length ?? 0;
  if (columnCount === 0) {
    return 0;
  }

  const u = new Array<number>(rowCount + 1).fill(0);
  const v = new Array<number>(columnCount + 1).fill(0);
  const p = new Array<number>(columnCount + 1).fill(0);
  const way = new Array<number>(columnCount + 1).fill(0);

  for (let row = 1; row <= rowCount; row += 1) {
    p[0] = row;
    let column0 = 0;
    const minv = new Array<number>(columnCount + 1).fill(Number.POSITIVE_INFINITY);
    const used = new Array<boolean>(columnCount + 1).fill(false);

    do {
      used[column0] = true;
      const row0 = p[column0];
      let delta = Number.POSITIVE_INFINITY;
      let nextColumn = 0;

      for (let column = 1; column <= columnCount; column += 1) {
        if (used[column]) {
          continue;
        }

        const current = costs[row0 - 1][column - 1] - u[row0] - v[column];
        if (current < minv[column]) {
          minv[column] = current;
          way[column] = column0;
        }
        if (minv[column] < delta) {
          delta = minv[column];
          nextColumn = column;
        }
      }

      for (let column = 0; column <= columnCount; column += 1) {
        if (used[column]) {
          u[p[column]] += delta;
          v[column] -= delta;
        } else {
          minv[column] -= delta;
        }
      }

      column0 = nextColumn;
    } while (p[column0] !== 0);

    do {
      const column1 = way[column0];
      p[column0] = p[column1];
      column0 = column1;
    } while (column0 !== 0);
  }

  const assignment = new Array<number>(rowCount).fill(-1);
  for (let column = 1; column <= columnCount; column += 1) {
    const row = p[column];
    if (row > 0) {
      assignment[row - 1] = column - 1;
    }
  }

  let total = 0;
  for (let row = 0; row < rowCount; row += 1) {
    const column = assignment[row];
    total += column >= 0 ? costs[row][column] : IMPOSSIBLE_ASSIGNMENT_COST;
  }

  return total;
}

export function estimateAssignmentCost(compiled: CompiledLevel, boxes: Uint16Array): number {
  return solveHungarian(buildCostMatrix(compiled, boxes));
}
