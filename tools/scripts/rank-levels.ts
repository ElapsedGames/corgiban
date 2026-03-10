import os from 'node:os';

import { builtinLevels } from '@corgiban/levels';
import {
  LEVEL_DIFFICULTY_SORTS,
  benchmarkLevelDifficulty,
  buildSuggestedLevelOrder,
  formatLevelDifficultyReport,
  hasLevelDifficultyFailures,
  rankLevelDifficultyResults,
  type LevelDifficultySort,
} from '../src/levelDifficultyReport';

type CliOptions = {
  timeBudgetMs: number;
  nodeBudget: number;
  sortBy: LevelDifficultySort;
  json: boolean;
  failOnLimit: boolean;
  maxLevels?: number;
};

function printHelp(): void {
  console.log(`Usage: pnpm levels:rank -- [options]

Options:
  --time-budget-ms <number>  Per-level solver budget. Default: 15000
  --node-budget <number>     Per-level node budget. Default: 2000000
  --sort <mode>              difficulty | pushes | moves | generated | elapsed
  --max-levels <number>      Only benchmark the first N built-in levels
  --json                     Emit JSON instead of text
  --no-fail-on-limit         Exit 0 even when a level times out or fails
  --help                     Show this help
`);
}

function parsePositiveInteger(raw: string, label: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return Math.floor(value);
}

function parseSort(raw: string): LevelDifficultySort {
  if (LEVEL_DIFFICULTY_SORTS.includes(raw as LevelDifficultySort)) {
    return raw as LevelDifficultySort;
  }
  throw new Error(`Unknown sort "${raw}". Expected one of: ${LEVEL_DIFFICULTY_SORTS.join(', ')}.`);
}

function parseCliArgs(argv: readonly string[]): CliOptions | null {
  const options: CliOptions = {
    timeBudgetMs: 15_000,
    nodeBudget: 2_000_000,
    sortBy: 'difficulty',
    json: false,
    failOnLimit: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help') {
      printHelp();
      return null;
    }

    if (argument === '--json') {
      options.json = true;
      continue;
    }

    if (argument === '--no-fail-on-limit') {
      options.failOnLimit = false;
      continue;
    }

    const nextValue = argv[index + 1];
    if (argument === '--time-budget-ms') {
      if (!nextValue) {
        throw new Error('--time-budget-ms requires a value.');
      }
      options.timeBudgetMs = parsePositiveInteger(nextValue, 'time budget');
      index += 1;
      continue;
    }

    if (argument === '--node-budget') {
      if (!nextValue) {
        throw new Error('--node-budget requires a value.');
      }
      options.nodeBudget = parsePositiveInteger(nextValue, 'node budget');
      index += 1;
      continue;
    }

    if (argument === '--sort') {
      if (!nextValue) {
        throw new Error('--sort requires a value.');
      }
      options.sortBy = parseSort(nextValue);
      index += 1;
      continue;
    }

    if (argument === '--max-levels') {
      if (!nextValue) {
        throw new Error('--max-levels requires a value.');
      }
      options.maxLevels = parsePositiveInteger(nextValue, 'max levels');
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument "${argument}". Use --help for usage.`);
  }

  return options;
}

function resolveHardwareConcurrency(): number {
  const available = typeof os.availableParallelism === 'function' ? os.availableParallelism() : 0;
  return available > 0 ? available : Math.max(1, os.cpus().length);
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (!options) {
    return;
  }

  const results = await benchmarkLevelDifficulty(builtinLevels, {
    environment: {
      userAgent: `node ${process.version}`,
      hardwareConcurrency: resolveHardwareConcurrency(),
      appVersion: 'local-tools',
    },
    timeBudgetMs: options.timeBudgetMs,
    nodeBudget: options.nodeBudget,
    ...(options.maxLevels !== undefined ? { maxLevels: options.maxLevels } : {}),
  });

  const ranked = rankLevelDifficultyResults(results, options.sortBy);
  if (options.json) {
    console.log(
      JSON.stringify(
        {
          algorithmId: 'bfsPush',
          timeBudgetMs: options.timeBudgetMs,
          nodeBudget: options.nodeBudget,
          sortBy: options.sortBy,
          suggestedLevelOrder: buildSuggestedLevelOrder(ranked, options.sortBy),
          hasFailures: hasLevelDifficultyFailures(ranked),
          results: ranked,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      formatLevelDifficultyReport(ranked, {
        algorithmId: 'bfsPush',
        timeBudgetMs: options.timeBudgetMs,
        nodeBudget: options.nodeBudget,
        sortBy: options.sortBy,
      }),
    );
  }

  if (options.failOnLimit && hasLevelDifficultyFailures(ranked)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
