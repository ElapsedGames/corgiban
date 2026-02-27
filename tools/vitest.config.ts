import { defineConfig } from 'vitest/config';

const coverageExclude = [
  '**/node_modules/**',
  '**/dist/**',
  '**/dist-types/**',
  '**/build/**',
  '**/coverage/**',
  '*.config.*',
  '**/scripts/**',
  '**/docs/**',
  'entry.client.tsx',
  'entry.server.tsx',
  'root.tsx',
];

export default defineConfig({
  root: './tools',
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      all: false,
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: coverageExclude,
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
});
