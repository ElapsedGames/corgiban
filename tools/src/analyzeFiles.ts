import { readFileSync } from 'node:fs';
import path from 'node:path';

export type SizeStatus = 'P' | 'W' | 'F';

export type FileRecord = {
  path: string;
  lines: number;
  sizeStatus: SizeStatus;
  hasTimeUsage: boolean;
};

/** Line count at or above which the file is flagged as a warning. */
const WARN_LINES = 300;
/** Line count at or above which the file is flagged as a failure. */
const FAIL_LINES = 550;

/** Patterns indicating direct time access that should live behind a clock abstraction. */
const TIME_USAGE_PATTERNS = [/\bDate\.now\(\)/, /\bnew Date\(\)/];

/**
 * Classify a line count into a pass/warn/fail status.
 *
 * - 'F' >= FAIL_LINES (550)
 * - 'W' >= WARN_LINES (300)
 * - 'P' otherwise
 */
export function classifySizeStatus(lines: number): SizeStatus {
  if (lines >= FAIL_LINES) return 'F';
  if (lines >= WARN_LINES) return 'W';
  return 'P';
}

/**
 * Return true when the source text contains any direct time-access expression
 * (Date.now() or new Date()).
 */
export function detectTimeUsage(source: string): boolean {
  return TIME_USAGE_PATTERNS.some((pattern) => pattern.test(source));
}

/**
 * Analyse a single source file and return a FileRecord.
 *
 * @param absolutePath - Absolute path to the file to read.
 * @param root - Repository root used to compute a relative display path.
 * @returns A FileRecord with line count, size status, and time-usage flag.
 */
export function analyzeFile(absolutePath: string, root: string): FileRecord {
  const source = readFileSync(absolutePath, 'utf8');
  const lines = source.split('\n').length;
  const sizeStatus = classifySizeStatus(lines);
  const hasTimeUsage = detectTimeUsage(source);
  const relativePath = path.relative(root, absolutePath);

  return {
    path: relativePath,
    lines,
    sizeStatus,
    hasTimeUsage,
  };
}

/**
 * Analyse all provided file paths and return records sorted by relative path.
 *
 * @param paths - Absolute paths to analyse.
 * @param root - Repository root for relative path computation.
 */
export function analyzeAll(paths: string[], root: string): FileRecord[] {
  return paths
    .map((p) => analyzeFile(p, root))
    .sort((left, right) => left.path.localeCompare(right.path));
}
