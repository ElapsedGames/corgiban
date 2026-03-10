import { expect, test } from '@playwright/test';

type MovePlan = {
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
  pushes: 0 | 1;
};

function parseRowsFromLabInput(input: string): string[] {
  const normalizedInput = input.replace(/\r\n?/g, '\n').trim();
  if (normalizedInput.startsWith('{')) {
    const parsed = JSON.parse(normalizedInput) as { rows?: unknown };
    if (Array.isArray(parsed.rows)) {
      return parsed.rows.filter((row): row is string => typeof row === 'string');
    }
  }

  return normalizedInput.split('\n');
}

function isPlayerToken(token: string | undefined): boolean {
  return token === 'P' || token === 'Q';
}

function isBoxToken(token: string | undefined): boolean {
  return token === 'B' || token === 'S';
}

function isWalkableToken(token: string | undefined): boolean {
  return token === ' ' || token === 'E' || token === 'T';
}

function findPreviewMove(rows: string[]): MovePlan {
  const playerRow = rows.findIndex((row) => row.split('').some((cell) => isPlayerToken(cell)));
  if (playerRow === -1) {
    throw new Error('Lab preview input did not contain a player token.');
  }

  const playerCol = rows[playerRow]?.split('').findIndex((cell) => isPlayerToken(cell)) ?? -1;
  if (playerCol === -1) {
    throw new Error('Lab preview input did not contain a player column.');
  }

  const moves: ReadonlyArray<{ key: MovePlan['key']; rowDelta: number; colDelta: number }> = [
    { key: 'ArrowUp', rowDelta: -1, colDelta: 0 },
    { key: 'ArrowRight', rowDelta: 0, colDelta: 1 },
    { key: 'ArrowDown', rowDelta: 1, colDelta: 0 },
    { key: 'ArrowLeft', rowDelta: 0, colDelta: -1 },
  ];

  for (const move of moves) {
    const nextRow = playerRow + move.rowDelta;
    const nextCol = playerCol + move.colDelta;
    const nextToken = rows[nextRow]?.[nextCol];

    if (isWalkableToken(nextToken)) {
      return { key: move.key, pushes: 0 };
    }

    if (!isBoxToken(nextToken)) {
      continue;
    }

    const beyondToken = rows[nextRow + move.rowDelta]?.[nextCol + move.colDelta];
    if (isWalkableToken(beyondToken)) {
      return { key: move.key, pushes: 1 };
    }
  }

  throw new Error('Lab preview input did not expose a playable move for smoke coverage.');
}

test('root route redirects to play', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('main', { name: 'Play Corgiban' })).toBeVisible();
});

test('clicking the shared brand link returns to play', async ({ page }) => {
  await page.goto('/bench');
  await expect(page.getByRole('heading', { name: 'Benchmark Suite' })).toBeVisible();

  await page.getByRole('link', { name: /Corgiban/i }).click();

  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('main', { name: 'Play Corgiban' })).toBeVisible();
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

  const labInput = await page.getByLabel('Encoded level input').inputValue();
  const move = findPreviewMove(parseRowsFromLabInput(labInput));

  await page.getByText('Preview / Play').click();
  await page.keyboard.press(move.key);

  await expect(page.getByText(`Moves: 1 | Pushes: ${move.pushes}`)).toBeVisible();
});
