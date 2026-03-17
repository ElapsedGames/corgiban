// Capture screenshots for README using Playwright
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '..', 'docs', 'media');
const port = process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? '43173';
const baseURL = `http://localhost:${port}`;

async function preparePage(page, route, theme) {
  await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
  await page.evaluate((nextTheme) => {
    localStorage.setItem('corgiban-theme', nextTheme);
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
}

async function assertCorgibanPage(page, expectedTitlePart, expectedHeading) {
  const title = await page.title();
  if (!title.includes(expectedTitlePart)) {
    throw new Error(`Expected page title to include "${expectedTitlePart}", got "${title}".`);
  }

  if (!(await page.getByRole('heading', { name: expectedHeading }).first().isVisible())) {
    throw new Error(`Expected heading "${expectedHeading}" to be visible before capturing.`);
  }
}

async function configureFastSingleLevelBench(page) {
  const levelSwitches = page.getByRole('group', { name: 'Levels' }).getByRole('switch');
  const switchCount = await levelSwitches.count();
  let keptCheckedLevel = false;

  for (let index = 0; index < switchCount; index += 1) {
    const currentSwitch = levelSwitches.nth(index);
    if ((await currentSwitch.getAttribute('aria-checked')) !== 'true') {
      continue;
    }

    if (!keptCheckedLevel) {
      keptCheckedLevel = true;
      continue;
    }

    await currentSwitch.click();
  }

  await page.getByRole('spinbutton', { name: 'Repetitions' }).fill('1');
  await page.getByRole('spinbutton', { name: 'Warm-up Runs' }).fill('0');
  await page.getByRole('spinbutton', { name: 'Time Budget (MS)' }).fill('100');
  await page.getByRole('spinbutton', { name: 'Node Budget' }).fill('5000');
  await page.getByRole('button', { name: 'Run Suite' }).click();
  await page
    .getByRole('definition')
    .filter({ hasText: /^Completed$/ })
    .first()
    .waitFor({ state: 'visible', timeout: 120_000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // --- 1a. Play mobile dark (375x812, iPhone-ish) ---
  {
    const ctx = await browser.newContext({
      colorScheme: 'dark',
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await preparePage(page, '/play', 'dark');
    await assertCorgibanPage(page, 'Corgiban', 'Play');
    await page.screenshot({
      path: path.join(outputDir, 'play-mobile.png'),
      fullPage: true,
    });
    console.log('[ok] play-mobile.png');
    await ctx.close();
  }

  // --- 1b. Play mobile light (375x812, iPhone-ish) ---
  {
    const ctx = await browser.newContext({
      colorScheme: 'light',
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await preparePage(page, '/play', 'light');
    await assertCorgibanPage(page, 'Corgiban', 'Play');
    await page.screenshot({
      path: path.join(outputDir, 'play-mobile-light.png'),
      fullPage: true,
    });
    console.log('[ok] play-mobile-light.png');
    await ctx.close();
  }

  // --- 2. Play desktop (1280x800) ---
  {
    const ctx = await browser.newContext({
      colorScheme: 'dark',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await preparePage(page, '/play', 'dark');
    await assertCorgibanPage(page, 'Corgiban', 'Play');
    await page.screenshot({
      path: path.join(outputDir, 'play-desktop.png'),
    });
    console.log('[ok] play-desktop.png');
    await ctx.close();
  }

  // --- 3. Bench (1280x800) ---
  {
    const ctx = await browser.newContext({
      colorScheme: 'dark',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await preparePage(page, '/bench', 'dark');
    await assertCorgibanPage(page, 'Corgiban', 'Benchmark Suite');
    await configureFastSingleLevelBench(page);
    await page.screenshot({
      path: path.join(outputDir, 'bench-history.png'),
      fullPage: true,
    });
    console.log('[ok] bench-history.png');
    await ctx.close();
  }

  // --- 4. Lab (1280x800) ---
  {
    const ctx = await browser.newContext({
      colorScheme: 'dark',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await preparePage(page, '/lab', 'dark');
    await assertCorgibanPage(page, 'Corgiban', 'Level Lab');
    await page.screenshot({
      path: path.join(outputDir, 'lab-authoring.png'),
      fullPage: true,
    });
    console.log('[ok] lab-authoring.png');
    await ctx.close();
  }

  await browser.close();
  console.log('\nAll screenshots captured!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
