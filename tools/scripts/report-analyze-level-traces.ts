import path from 'node:path';

import { writeAnalyzeLevelTraceReport } from '../src/analyzeLevelTraceReport';

type ScriptOptions = {
  inputDir: string;
  longTaskThresholdMs: number;
  outputPath: string;
};

const defaultInputDir = path.resolve(process.cwd(), 'artifacts', 'analyze-level-browser-profile');

function printUsage(): void {
  console.log(`Usage: pnpm profile:analyze-level:report -- [options]

Options:
  --input-dir <path>         Directory containing *.trace.json files.
                             Default: artifacts/analyze-level-browser-profile
  --output <path>            Markdown output path.
                             Default: <input-dir>/trace-report.md
  --threshold-ms <number>    Long-task threshold in milliseconds. Default: 50
  --help                     Show this message.
`);
}

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    inputDir: defaultInputDir,
    longTaskThresholdMs: 50,
    outputPath: path.resolve(defaultInputDir, 'trace-report.md'),
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

    if (argument === '--input-dir') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --input-dir.');
      }
      options.inputDir = path.resolve(process.cwd(), value);
      if (options.outputPath === path.resolve(defaultInputDir, 'trace-report.md')) {
        options.outputPath = path.resolve(options.inputDir, 'trace-report.md');
      }
      index += 1;
      continue;
    }

    if (argument === '--output') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --output.');
      }
      options.outputPath = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }

    if (argument === '--threshold-ms') {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Expected --threshold-ms to be a number > 0.');
      }
      options.longTaskThresholdMs = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const scenarioReports = writeAnalyzeLevelTraceReport({
    inputDir: options.inputDir,
    options: {
      longTaskThresholdMs: options.longTaskThresholdMs,
    },
    outputPath: options.outputPath,
  });

  console.log(
    `AnalyzeLevel trace report written to ${path.relative(process.cwd(), options.outputPath)}`,
  );
  console.log(`Scenario count: ${scenarioReports.length}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('AnalyzeLevel trace report generation failed.');
  console.error(message);
  process.exit(1);
});
