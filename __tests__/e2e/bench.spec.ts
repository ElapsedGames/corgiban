import { expect, test } from '@playwright/test';

import {
  configureFastSingleLevelSuite,
  readBenchRunCount,
  waitForBenchCompleted,
} from './helpers/bench';

test('bench route keeps benchmark results after reload', async ({ page }) => {
  await page.goto('/bench');
  await expect(page.getByRole('heading', { name: 'Benchmark Suite' })).toBeVisible();

  const runsBefore = await readBenchRunCount(page);
  await configureFastSingleLevelSuite(page);
  await page.getByRole('button', { name: 'Run Suite' }).click();

  await waitForBenchCompleted(page);
  await expect
    .poll(() => readBenchRunCount(page), { timeout: 120_000 })
    .toBeGreaterThan(runsBefore);

  const runsAfter = await readBenchRunCount(page);
  await expect(page.getByRole('button', { name: 'Export History' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Clear Results' })).toBeEnabled();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Benchmark Suite' })).toBeVisible();
  await expect.poll(() => readBenchRunCount(page), { timeout: 20_000 }).toBe(runsAfter);
});

test('bench route can clear benchmark history', async ({ page }) => {
  await page.goto('/bench');
  await expect(page.getByRole('heading', { name: 'Benchmark Suite' })).toBeVisible();

  await configureFastSingleLevelSuite(page);
  await page.getByRole('button', { name: 'Run Suite' }).click();
  await waitForBenchCompleted(page);
  await expect(page.getByRole('button', { name: 'Clear Results' })).toBeEnabled();

  await page.getByRole('button', { name: 'Clear Results' }).click();
  await expect.poll(() => readBenchRunCount(page), { timeout: 20_000 }).toBe(0);

  await page.reload();
  await expect.poll(() => readBenchRunCount(page), { timeout: 20_000 }).toBe(0);
});
