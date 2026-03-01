import { isTarget, isWall } from '../model/cell';
import type { LevelRuntime } from '../model/level';

export function serializeLevel(level: LevelRuntime): string[] {
  const { width, height, staticGrid, initialPlayerIndex, initialBoxes } = level;
  const expectedSize = width * height;

  if (staticGrid.length !== expectedSize) {
    throw new Error(
      `Level staticGrid size ${staticGrid.length} does not match width*height ${expectedSize}.`,
    );
  }

  const boxSet = new Set<number>();
  for (const box of initialBoxes) {
    boxSet.add(box);
  }

  const rows: string[] = [];

  for (let row = 0; row < height; row += 1) {
    let rowText = '';
    for (let col = 0; col < width; col += 1) {
      const index = row * width + col;
      if (isWall(staticGrid[index])) {
        rowText += 'W';
        continue;
      }

      const hasBox = boxSet.has(index);
      const hasPlayer = index === initialPlayerIndex;

      if (hasBox && hasPlayer) {
        throw new Error('Level has overlapping player and box positions.');
      }

      if (hasPlayer) {
        rowText += isTarget(staticGrid[index]) ? 'Q' : 'P';
        continue;
      }

      if (hasBox) {
        rowText += isTarget(staticGrid[index]) ? 'S' : 'B';
        continue;
      }

      rowText += isTarget(staticGrid[index]) ? 'T' : 'E';
    }
    rows.push(rowText);
  }

  return rows;
}
