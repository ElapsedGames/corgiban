import type { CompiledLevel } from '../state/compiledLevel';

export function estimateManhattanCost(compiled: CompiledLevel, boxes: Uint16Array): number {
  if (boxes.length === 0 || compiled.goalCells.length === 0) {
    return 0;
  }

  let total = 0;

  for (let boxIndex = 0; boxIndex < boxes.length; boxIndex += 1) {
    const boxGlobalIndex = compiled.cellToGlobal[boxes[boxIndex]];
    const boxRow = Math.floor(boxGlobalIndex / compiled.width);
    const boxCol = boxGlobalIndex % compiled.width;

    let best = Number.POSITIVE_INFINITY;

    for (let goalIndex = 0; goalIndex < compiled.goalCells.length; goalIndex += 1) {
      const goalGlobalIndex = compiled.cellToGlobal[compiled.goalCells[goalIndex]];
      const goalRow = Math.floor(goalGlobalIndex / compiled.width);
      const goalCol = goalGlobalIndex % compiled.width;
      const distance = Math.abs(boxRow - goalRow) + Math.abs(boxCol - goalCol);
      if (distance < best) {
        best = distance;
      }
    }

    total += Number.isFinite(best) ? best : 0;
  }

  return total;
}
