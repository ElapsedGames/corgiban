import glob from 'fast-glob';

export type ScanOptions = {
  root: string;
  include: string[];
  exclude: string[];
};

export const DEFAULT_SCAN_INCLUDE = [
  'packages/*/src/**/*.{ts,tsx,js,jsx,mjs}',
  'apps/web/app/**/*.{ts,tsx,js,jsx,mjs}',
];

export const DEFAULT_SCAN_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/dist-types/**',
  '**/build/**',
  '**/coverage/**',
  '**/docs/_generated/**',
];

export async function scanFiles(options: ScanOptions): Promise<string[]> {
  return glob(options.include, {
    absolute: true,
    cwd: options.root,
    ignore: options.exclude,
    onlyFiles: true,
    unique: true,
  });
}
