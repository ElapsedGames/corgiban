import { expect, type Locator, type Page } from '@playwright/test';

const BENCH_RUN_COUNT_PATTERN = /^Saved benchmark runs \((\d+)\)\./;

async function uncheckIfChecked(locator: Locator): Promise<void> {
  if ((await locator.getAttribute('aria-checked')) === 'true') {
    await locator.click();
  }
}

async function keepOnlyFirstCheckedLevel(page: Page): Promise<void> {
  const levelSwitches = page.getByRole('group', { name: 'Levels' }).getByRole('switch');
  const checkboxCount = await levelSwitches.count();
  let keptCheckedLevel = false;

  for (let index = 0; index < checkboxCount; index += 1) {
    const checkbox = levelSwitches.nth(index);
    if ((await checkbox.getAttribute('aria-checked')) !== 'true') {
      continue;
    }

    if (!keptCheckedLevel) {
      keptCheckedLevel = true;
      continue;
    }

    await uncheckIfChecked(checkbox);
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
  await keepOnlyFirstCheckedLevel(page);
  await page.getByRole('spinbutton', { name: 'Repetitions' }).fill('1');
  await page.getByRole('spinbutton', { name: 'Warm-up Runs' }).fill('0');
  await page.getByRole('spinbutton', { name: 'Time Budget (MS)' }).fill('100');
  await page.getByRole('spinbutton', { name: 'Node Budget' }).fill('5000');
}

export async function waitForBenchCompleted(page: Page): Promise<void> {
  await expect(
    page
      .getByRole('definition')
      .filter({ hasText: /^Completed$/ })
      .first(),
  ).toBeVisible({ timeout: 120_000 });
}
