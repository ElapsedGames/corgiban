import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, type BrowserContext, type Page } from '@playwright/test';

import {
  createAnalyzeLevelStressLevelDefinition,
  createAnalyzeLevelStressLevelJson,
  getSlowestBuiltinAnalyzeLevelSample,
} from '../src/analyzeLevelProfile';
import { writeAnalyzeLevelTraceReport } from '../src/analyzeLevelTraceReport';

type ScriptOptions = {
  baseUrl: string;
  cpuThrottleRate: number;
  outputDir: string;
  fixturesOnly: boolean;
};

type ScenarioResult = {
  id: string;
  description: string;
  tracePath: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultOutputDir = path.resolve(repoRoot, 'artifacts', 'analyze-level-browser-profile');

function printUsage(): void {
  console.log(`Usage: pnpm profile:analyze-level:browser -- [options]

Options:
  --base-url <url>           Preview base URL to profile. Default: http://127.0.0.1:8788
  --cpu-throttle-rate <n>    Chromium CPU throttle multiplier. Default: 4
  --output-dir <path>        Output directory for traces and summary. Default: artifacts/analyze-level-browser-profile
  --fixtures-only            Skip browser capture and only write the stress fixture + summary.
  --help                     Show this message.
`);
}

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    baseUrl: process.env.CORGIBAN_PROFILE_BASE_URL?.trim() || 'http://127.0.0.1:8788',
    cpuThrottleRate: 4,
    outputDir: defaultOutputDir,
    fixturesOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument) {
      continue;
    }

    if (argument === '--help') {
      printUsage();
      process.exit(0);
    }

    if (argument === '--fixtures-only') {
      options.fixturesOnly = true;
      continue;
    }

    if (argument === '--base-url') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --base-url.');
      }
      options.baseUrl = value;
      index += 1;
      continue;
    }

    if (argument === '--cpu-throttle-rate') {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value < 1) {
        throw new Error('Expected --cpu-throttle-rate to be a number >= 1.');
      }
      options.cpuThrottleRate = value;
      index += 1;
      continue;
    }

    if (argument === '--output-dir') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --output-dir.');
      }
      options.outputDir = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  options.baseUrl = options.baseUrl.replace(/\/+$/, '');
  return options;
}

function sanitizeFileName(value: string): string {
  return value
    .replace(/[^a-z0-9-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

async function warmRoute(
  page: Page,
  routePath: string,
  readySelector: { role: string; name: string },
): Promise<void> {
  await page.goto(routePath, { waitUntil: 'domcontentloaded' });
  await page.getByRole(readySelector.role as never, { name: readySelector.name }).waitFor();
  await page.waitForTimeout(300);
}

async function captureTrace(
  context: BrowserContext,
  page: Page,
  tracePath: string,
  cpuThrottleRate: number,
  action: () => Promise<void>,
): Promise<void> {
  const session = await context.newCDPSession(page);
  if (cpuThrottleRate > 1) {
    await session.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottleRate });
  }

  const traceEvents: unknown[] = [];
  const onDataCollected = ({ value }: { value?: unknown[] }) => {
    if (Array.isArray(value)) {
      traceEvents.push(...value);
    }
  };
  session.on('Tracing.dataCollected', onDataCollected);

  await session.send('Tracing.start', {
    categories: [
      'devtools.timeline',
      'v8.execute',
      'disabled-by-default-v8.cpu_profiler',
      'disabled-by-default-v8.cpu_profiler.hires',
    ].join(','),
    options: 'sampling-frequency=10000',
    transferMode: 'ReportEvents',
  });

  await action();
  await page.waitForTimeout(750);

  const tracingComplete = new Promise<void>((resolve) => {
    session.once('Tracing.tracingComplete', () => {
      resolve();
    });
  });
  await session.send('Tracing.end');
  await tracingComplete;
  session.off('Tracing.dataCollected', onDataCollected);

  writeFileSync(
    tracePath,
    JSON.stringify(
      {
        traceEvents,
        metadata: {
          capturedAt: new Date().toISOString(),
          cpuThrottleRate,
        },
      },
      null,
      2,
    ),
    'utf8',
  );
}

function writeSummary(
  options: ScriptOptions,
  summaryPath: string,
  stressFixturePath: string,
  slowestBuiltinLevel: ReturnType<typeof getSlowestBuiltinAnalyzeLevelSample>,
  scenarioResults: ScenarioResult[],
): void {
  const scenarioLines =
    scenarioResults.length > 0
      ? scenarioResults
          .map(
            (scenario) =>
              `- \`${scenario.id}\`: ${scenario.description} -> \`${path.relative(repoRoot, scenario.tracePath)}\``,
          )
          .join('\n')
      : '- Browser trace capture skipped (`--fixtures-only`).';

  const summary = `# AnalyzeLevel Browser Profile

Generated: ${new Date().toISOString()}

## Configuration

- Base URL: \`${options.baseUrl}\`
- CPU throttle rate: ${options.cpuThrottleRate}x
- Fixtures only: ${options.fixturesOnly ? 'yes' : 'no'}

## Slowest Built-in Level (Node-side selector)

- Level id: \`${slowestBuiltinLevel.levelId}\`
- Level name: ${slowestBuiltinLevel.levelName}
- Mean analyzeLevel cost: ${slowestBuiltinLevel.meanMs.toFixed(4)} ms
- Total sample cost: ${slowestBuiltinLevel.totalMs.toFixed(4)} ms

## Browser Artifacts

${scenarioLines}

## Stress Fixture

- Paste or import \`${path.relative(repoRoot, stressFixturePath)}\` into \`/lab\`
- Suggested steps:
  1. Open \`${options.baseUrl}/lab\`
  2. Paste the JSON fixture into the encoded level input
  3. Click \`Parse Level\`
  4. Record a DevTools Performance trace around \`Run Solve\` or \`Run Bench\`

## Inspection Target

Search the trace for \`analyzeLevel\` and confirm whether it descends into:

- \`compileLevel\`
- \`buildGoalDistances\`

If that stack becomes a repeatable >16ms slice on throttled built-in traces or materially contributes
to a >50ms long task, keep DEBT-012 open and treat caching/off-thread follow-up as justified.
`;

  writeFileSync(summaryPath, summary, 'utf8');
}

async function capturePlayLevelHandoffTrace(
  context: BrowserContext,
  tracePath: string,
  cpuThrottleRate: number,
  slowestLevelId: string,
): Promise<ScenarioResult> {
  const page = await context.newPage();
  await warmRoute(page, '/play', { role: 'main', name: 'Play Corgiban' });

  await captureTrace(context, page, tracePath, cpuThrottleRate, async () => {
    await page.goto(`/play?levelId=${encodeURIComponent(slowestLevelId)}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByRole('main', { name: 'Play Corgiban' }).waitFor();
    await page.locator('aside h2[title]').first().waitFor();
  });

  await page.close();
  return {
    id: 'play-level-handoff',
    description: 'Warm /play, then navigate to the slowest built-in level via handoff param.',
    tracePath,
  };
}

async function captureLabClickTrace(
  context: BrowserContext,
  tracePath: string,
  cpuThrottleRate: number,
  slowestLevelId: string,
  buttonName: 'Run Solve' | 'Run Bench',
  scenarioId: string,
): Promise<ScenarioResult> {
  const page = await context.newPage();
  await warmRoute(page, `/lab?levelId=${encodeURIComponent(slowestLevelId)}`, {
    role: 'heading',
    name: 'Level Lab',
  });

  await captureTrace(context, page, tracePath, cpuThrottleRate, async () => {
    await page.getByRole('button', { name: buttonName }).click();
  });

  await page.close();
  return {
    id: scenarioId,
    description: `Warm /lab on the slowest built-in level, then capture the ${buttonName} click path.`,
    tracePath,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  mkdirSync(options.outputDir, { recursive: true });

  const slowestBuiltinLevel = getSlowestBuiltinAnalyzeLevelSample();
  const stressFixturePath = path.resolve(options.outputDir, 'stress-level.corg.json');
  writeFileSync(stressFixturePath, createAnalyzeLevelStressLevelJson(), 'utf8');

  const metadataPath = path.resolve(options.outputDir, 'stress-level.metadata.json');
  writeFileSync(
    metadataPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        stressLevel: createAnalyzeLevelStressLevelDefinition(),
        slowestBuiltinLevel,
      },
      null,
      2,
    ),
    'utf8',
  );

  const scenarioResults: ScenarioResult[] = [];

  if (!options.fixturesOnly) {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        baseURL: options.baseUrl,
        viewport: { width: 1440, height: 1024 },
      });

      const playTracePath = path.resolve(
        options.outputDir,
        `${sanitizeFileName('play-level-handoff')}.trace.json`,
      );
      scenarioResults.push(
        await capturePlayLevelHandoffTrace(
          context,
          playTracePath,
          options.cpuThrottleRate,
          slowestBuiltinLevel.levelId,
        ),
      );

      const labSolveTracePath = path.resolve(
        options.outputDir,
        `${sanitizeFileName('lab-run-solve')}.trace.json`,
      );
      scenarioResults.push(
        await captureLabClickTrace(
          context,
          labSolveTracePath,
          options.cpuThrottleRate,
          slowestBuiltinLevel.levelId,
          'Run Solve',
          'lab-run-solve',
        ),
      );

      const labBenchTracePath = path.resolve(
        options.outputDir,
        `${sanitizeFileName('lab-run-bench')}.trace.json`,
      );
      scenarioResults.push(
        await captureLabClickTrace(
          context,
          labBenchTracePath,
          options.cpuThrottleRate,
          slowestBuiltinLevel.levelId,
          'Run Bench',
          'lab-run-bench',
        ),
      );

      await context.close();
    } catch (error) {
      await browser.close();
      throw error;
    }

    await browser.close();
  }

  const summaryPath = path.resolve(options.outputDir, 'summary.md');
  writeSummary(options, summaryPath, stressFixturePath, slowestBuiltinLevel, scenarioResults);
  if (scenarioResults.length > 0) {
    writeAnalyzeLevelTraceReport({
      inputDir: options.outputDir,
      outputPath: path.resolve(options.outputDir, 'trace-report.md'),
    });
  }

  console.log(
    `AnalyzeLevel browser profile written to ${path.relative(repoRoot, options.outputDir)}`,
  );
  console.log(
    `Slowest built-in level: ${slowestBuiltinLevel.levelId} (${slowestBuiltinLevel.meanMs.toFixed(4)} ms)`,
  );
  if (options.fixturesOnly) {
    console.log('Browser capture skipped (--fixtures-only).');
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('AnalyzeLevel browser profile failed.');
  console.error(message);
  console.error(
    'Start the preview server first with `pnpm build` and `pnpm -C apps/web preview:cloudflare`, or pass `--fixtures-only` to generate local fixtures without browser capture.',
  );
  process.exit(1);
});
