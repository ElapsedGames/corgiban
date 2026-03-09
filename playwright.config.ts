import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 43173);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './__tests__/e2e',
  testMatch: '*.spec.ts',
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    headless: true,
  },
  webServer: {
    command: 'pnpm -C apps/web preview:cloudflare',
    url: baseURL,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
    },
  },
});
