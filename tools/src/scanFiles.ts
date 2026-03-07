import fg from 'fast-glob';

export type ScanOptions = {
  /** Absolute path to the repository root used as the cwd for glob resolution. */
  root: string;
  /** Glob patterns of files to include (relative to root). */
  include: string[];
  /** Glob patterns of files to exclude (relative to root). */
  exclude: string[];
};

/**
 * Scan the repository for files matching the include patterns, minus any
 * matches for the exclude patterns.
 *
 * Returns absolute paths sorted lexicographically.
 */
export async function scanFiles(options: ScanOptions): Promise<string[]> {
  if (options.include.length === 0) {
    return [];
  }

  const matches = await fg(options.include, {
    cwd: options.root,
    ignore: options.exclude,
    absolute: true,
    dot: false,
    onlyFiles: true,
  });

  return matches.sort((a, b) => a.localeCompare(b));
}
