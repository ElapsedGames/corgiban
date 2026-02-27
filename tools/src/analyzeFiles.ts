export type SizeStatus = 'P' | 'W' | 'F';

export type FileRecord = {
  path: string;
  lines: number;
  sizeStatus: SizeStatus;
  hasTimeUsage: boolean;
};

export function analyzeFile(absolutePath: string, _root: string): FileRecord {
  return {
    path: absolutePath,
    lines: 0,
    sizeStatus: 'P',
    hasTimeUsage: false,
  };
}

export function analyzeAll(paths: string[], root: string): FileRecord[] {
  return paths
    .map((path) => analyzeFile(path, root))
    .sort((left, right) => left.path.localeCompare(right.path));
}
