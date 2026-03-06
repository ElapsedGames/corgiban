import { expect, test } from '@playwright/test';

test('play route applies sequence input and supports restart and next level', async ({ page }) => {
  await page.goto('/play');
  await expect(page.getByRole('heading', { name: 'Corgiban' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous level' })).toHaveCount(0);

  await page.getByLabel('Sequence input').fill('R');
  await page.getByRole('button', { name: 'Apply moves' }).click();

  await expect(page.getByText('Applied 1 moves.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await expect(page.getByText('1 total')).toBeVisible();

  await page.getByRole('button', { name: 'Restart' }).click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(
    page.getByText('No moves yet. Use the keyboard or sequence input to start.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Next level' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Classic 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous level' })).toBeVisible();

  await page.getByRole('button', { name: 'Previous level' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Classic 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous level' })).toHaveCount(0);
});

test('play route runs solver and enables apply solution', async ({ page }) => {
  await page.goto('/play');
  await expect(page.getByRole('heading', { name: 'Corgiban' })).toBeVisible();

  await page.getByRole('button', { name: 'Run solve' }).click();

  const applySolution = page.getByRole('button', { name: 'Apply solution' });
  await expect(applySolution).toBeEnabled({ timeout: 120_000 });

  await applySolution.click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await expect(page.getByText(/[1-9]\d* total/).first()).toBeVisible();
});
