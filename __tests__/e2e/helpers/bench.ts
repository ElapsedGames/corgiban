import { expect, type Locator, type Page } from '@playwright/test';

const BENCH_RUN_COUNT_PATTERN = /^Stored benchmark history \((\d+) runs\)\./;

async function uncheckIfChecked(locator: Locator): Promise<void> {
  if (await locator.isChecked()) {
    await locator.click();
  }
}

export async function readBenchRunCount(page: Page): Promise<number> {
  const summary = page.getByText(BENCH_RUN_COUNT_PATTERN).first();
  await expect(summary).toBeVisible();

  const text = await summary.textContent();
  const match = text?.match(BENCH_RUN_COUNT_PATTERN);
  if (!match) {
    throw new Error(`Failed to parse benchmark run count from summary: ${text ?? 'null'}`);
  }

  return Number.parseInt(match[1], 10);
}

export async function configureFastSingleLevelSuite(page: Page): Promise<void> {
  await uncheckIfChecked(page.getByRole('checkbox', { name: /Classic 2 \(classic-002\)/ }));
  await uncheckIfChecked(page.getByRole('checkbox', { name: /Classic 3 \(classic-003\)/ }));
  await page.getByLabel('Repetitions', { exact: true }).fill('1');
  await page.getByLabel('Warm-up Repetitions', { exact: true }).fill('0');
  await page.getByLabel('Time Budget (ms)').fill('100');
  await page.getByLabel('Node Budget').fill('5000');
}

export async function waitForBenchCompleted(page: Page): Promise<void> {
  await expect(
    page
      .getByRole('definition')
      .filter({ hasText: /^Completed$/ })
      .first(),
  ).toBeVisible({ timeout: 120_000 });
}
