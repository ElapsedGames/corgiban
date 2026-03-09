import { expect, test } from '@playwright/test';

test('play route applies sequence input and supports restart and next level', async ({ page }) => {
  await page.goto('/play');
  await expect(page.getByRole('main', { name: 'Play Corgiban' })).toBeVisible();
  await expect(page.getByTitle('Classic 1').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();

  await page.getByRole('textbox', { name: 'Sequence input' }).fill('R');
  await page.getByRole('button', { name: 'Apply Moves' }).click();

  await expect(page.getByText('Applied 1 moves.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await expect(page.getByText('1 total')).toBeVisible();

  await page.getByRole('button', { name: 'Restart' }).click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(
    page.getByText('No moves yet. Use the keyboard or sequence input to start.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Next Level' }).click();
  await expect(page.getByTitle('Classic 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled();

  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByTitle('Classic 1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
});

test('play route runs solver and enables apply solution', async ({ page }) => {
  await page.goto('/play');
  await expect(page.getByRole('main', { name: 'Play Corgiban' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Solver' })).toBeVisible();

  await page.getByRole('button', { name: 'Run Solve' }).click();

  const applySolution = page.getByRole('button', { name: 'Apply Solution' });
  await expect(applySolution).toBeEnabled({ timeout: 120_000 });

  await applySolution.click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await expect(page.getByText(/[1-9]\d* total/).first()).toBeVisible();
});
