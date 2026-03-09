import { expect, test } from '@playwright/test';

test('root route links to the main play, bench, and lab workflows', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Corgiban' })).toBeVisible();
  const routeNav = page.getByRole('navigation', { name: 'App routes' });

  await expect(routeNav.getByRole('link', { name: 'Play' })).toBeVisible();
  await expect(routeNav.getByRole('link', { name: 'Benchmark' })).toBeVisible();
  await expect(routeNav.getByRole('link', { name: 'Lab' })).toBeVisible();
  await expect(routeNav.getByRole('link', { name: 'UI Kit' })).toHaveCount(0);
});

test('ui kit route supports tab and dialog interactions', async ({ page }) => {
  await page.goto('/dev/ui-kit');
  await expect(page.getByRole('heading', { name: 'UI Kit' })).toBeVisible();

  await page.getByRole('tab', { name: 'Beta' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Beta' })).toContainText('Selected tab: beta');

  await page.getByRole('button', { name: 'Open dialog' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export level pack' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog).not.toBeVisible();
});

test('lab route loads editor and worker action controls', async ({ page }) => {
  await page.goto('/lab');
  await expect(page.getByRole('heading', { name: 'Level Lab' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Parse Level' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Solve' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Bench' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'U', exact: true })).toHaveCount(0);
  await expect(page.getByText('Moves: 0 | Pushes: 0')).toBeVisible();

  await page.keyboard.press('ArrowRight');

  await expect(page.getByText('Moves: 1 | Pushes: 0')).toBeVisible();
});
