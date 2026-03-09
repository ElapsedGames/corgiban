import { expect, test } from '@playwright/test';

test('unknown routes render the 404 page and link back to play', async ({ page }) => {
  const response = await page.goto('/smoke-route-does-not-exist');

  expect(response).not.toBeNull();
  expect(response?.status()).toBe(404);

  await expect(page).toHaveTitle('404 Not Found | Corgiban');
  await expect(page.getByRole('heading', { name: '404 Not Found' })).toBeVisible();
  await expect(page.getByText('/smoke-route-does-not-exist')).toBeVisible();
  await expect(page.getByText('does not exist.')).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Recovery links' })
    .getByRole('link', { name: 'Play' })
    .click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('main', { name: 'Play Corgiban' })).toBeVisible();
});
