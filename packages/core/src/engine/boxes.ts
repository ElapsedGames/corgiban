export function moveBoxSorted(boxes: Uint32Array, fromIndex: number, toIndex: number): Uint32Array {
  const next = Array.from(boxes);
  const boxIndex = next.indexOf(fromIndex);
  if (boxIndex === -1) {
    throw new Error('Box not found at expected position.');
  }
  next[boxIndex] = toIndex;
  next.sort((a, b) => a - b);
  return Uint32Array.from(next);
}
