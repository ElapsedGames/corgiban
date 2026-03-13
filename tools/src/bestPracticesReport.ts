import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { analyzeAll } from './analyzeFiles';
import { formatReport } from './reportFormatter';
import { DEFAULT_SCAN_EXCLUDE, DEFAULT_SCAN_INCLUDE, scanFiles } from './scanFiles';

export const DEFAULT_REPORT_OUT_DIR = 'docs/_generated/analysis';
export const REPORT_FILENAME = 'best_practices_report.md';

export type BestPracticesRunOptions = {
  root?: string;
  generatedAt?: Date;
};

/**
 * Parse the --out-dir flag from an argv array.
 *
 * Returns the flag value when present and non-empty, or null when absent or
 * the value is missing / starts with '-' (another flag).
 */
export function parseOutDir(argv: string[]): string | null {
  const flagIndex = argv.indexOf('--out-dir');
  if (flagIndex === -1) {
    return null;
  }

  const value = argv[flagIndex + 1];
  if (!value || value.startsWith('-')) {
    return null;
  }

  return value;
}

export async function run(
  argv: string[] = process.argv.slice(2),
  options: BestPracticesRunOptions = {},
): Promise<void> {
  const root = options.root ?? process.cwd();
  const outDir = parseOutDir(argv) ?? DEFAULT_REPORT_OUT_DIR;
  const absoluteOutDir = path.resolve(root, outDir);
  const reportPath = path.join(absoluteOutDir, REPORT_FILENAME);
  const paths = await scanFiles({
    root,
    include: DEFAULT_SCAN_INCLUDE,
    exclude: DEFAULT_SCAN_EXCLUDE,
  });
  const records = analyzeAll(paths, root);
  const report = formatReport(records, options.generatedAt ?? new Date());

  await mkdir(absoluteOutDir, { recursive: true });
  await writeFile(reportPath, report, 'utf8');

  const relativeReportPath = path.relative(root, reportPath).split(path.sep).join('/');
  console.log(`Wrote ${relativeReportPath}`);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  run().catch((error) => {
    console.error('best-practices report command failed:', error);
    process.exitCode = 1;
  });
}
