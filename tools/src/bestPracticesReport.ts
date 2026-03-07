import { pathToFileURL } from 'node:url';

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

export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  const outDir = parseOutDir(argv);
  const suffix = outDir ? ` (requested out dir: ${outDir})` : '';
  // tracked: DEBT-007 -- full implementation deferred
  console.log(`best-practices report generation is unavailable.${suffix}`);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  run().catch((error) => {
    console.error('best-practices report command failed:', error);
    process.exitCode = 1;
  });
}
