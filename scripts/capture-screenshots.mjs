// Capture dark-mode screenshots for README using Playwright
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '..', 'docs', 'media');
const port = process.env.PORT ?? '5173';
const baseURL = `http://localhost:${port}`;

async function main() {
  const browser = await chromium.launch({ headless: true });

  // --- 1. Play mobile (375x812, iPhone-ish) ---
  {
    const ctx = await browser.newContext({
      colorScheme: 'dark',
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.goto(`${baseURL}/play`, { waitUntil: 'networkidle' });
    // Set dark theme via localStorage and reload
    await page.evaluate(() => {
      localStorage.setItem('corgiban-theme', 'dark');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(outputDir, 'play-mobile.png'),
      fullPage: true,
    });
    console.log('[ok] play-mobile.png');
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
    await page.goto(`${baseURL}/play`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.setItem('corgiban-theme', 'dark');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
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
    await page.goto(`${baseURL}/bench`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.setItem('corgiban-theme', 'dark');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
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
    await page.goto(`${baseURL}/lab`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.setItem('corgiban-theme', 'dark');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
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
