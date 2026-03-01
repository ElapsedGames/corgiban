export function hash(key: string): number {
  let value = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    value ^= key.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}
