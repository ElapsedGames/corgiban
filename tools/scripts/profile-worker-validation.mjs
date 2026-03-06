import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import createJiti from 'jiti';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const outputPath = path.resolve(
  repoRoot,
  'docs',
  '_generated',
  'analysis',
  'phase-04-protocol-validation-profile.md',
);

const jiti = createJiti(import.meta.url);
const { parseWorkerOutboundMessage } = jiti(
  path.resolve(repoRoot, 'packages/worker/src/protocol/schema.ts'),
);
const { validateOutboundMessage } = jiti(
  path.resolve(repoRoot, 'packages/worker/src/protocol/validation.ts'),
);
const { DEFAULT_SOLVER_PROGRESS_THROTTLE_MS } = jiti(
  path.resolve(repoRoot, 'packages/solver/src/api/solverConstants.ts'),
);

const ITERATIONS = 250_000;
const WARMUP_ITERATIONS = 25_000;

const solveProgressPayload = {
  type: 'SOLVE_PROGRESS',
  runId: 'bench-run-1',
  protocolVersion: 2,
  expanded: 1337,
  generated: 2048,
  depth: 51,
  frontier: 87,
  elapsedMs: 1325.5,
  bestHeuristic: 11,
  bestPathSoFar: 'UURRDDLL',
};

const benchResultPayload = {
  type: 'BENCH_RESULT',
  runId: 'bench-run-1',
  protocolVersion: 2,
  benchmarkCaseId: 'case-1',
  status: 'solved',
  solutionMoves: 'RR',
  metrics: {
    elapsedMs: 1325.5,
    expanded: 1337,
    generated: 2048,
    maxDepth: 51,
    maxFrontier: 87,
    pushCount: 4,
    moveCount: 9,
  },
};

const simulatedBenchmarkElapsedSamplesMs = [1200, 1500, 1700, 1950, 2300, 2750, 3200];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function profile(label, fn, payload) {
  for (let index = 0; index < WARMUP_ITERATIONS; index += 1) {
    fn(payload);
  }

  const startedAt = performance.now();
  for (let index = 0; index < ITERATIONS; index += 1) {
    fn(payload);
  }
  const elapsedMs = performance.now() - startedAt;
  const perCallMs = elapsedMs / ITERATIONS;
  const perCallUs = perCallMs * 1000;

  return {
    label,
    elapsedMs,
    perCallMs,
    perCallUs,
  };
}

function toFixed(value, digits = 4) {
  return Number(value).toFixed(digits);
}

const strictProgressProfile = profile(
  'strict-progress-parse',
  (payload) => {
    const parsed = parseWorkerOutboundMessage(payload);
    if (!parsed.success) {
      throw new Error('Strict SOLVE_PROGRESS parse failed during profiling.');
    }
  },
  solveProgressPayload,
);

const lightProgressProfile = profile(
  'light-progress-validate',
  (payload) => {
    const parsed = validateOutboundMessage(payload, { mode: 'light-progress' });
    if (!parsed.ok) {
      throw new Error('Light SOLVE_PROGRESS validation failed during profiling.');
    }
  },
  solveProgressPayload,
);

const structuralProfile = profile(
  'structural-bench-result-validate',
  (payload) => {
    const parsed = validateOutboundMessage(payload, { mode: 'light-progress' });
    if (!parsed.ok) {
      throw new Error('Structural BENCH_RESULT validation failed during profiling.');
    }
  },
  benchResultPayload,
);

const medianElapsedMs = median(simulatedBenchmarkElapsedSamplesMs);
const solveProgressMessagesPerRun = Math.max(
  1,
  Math.ceil(medianElapsedMs / DEFAULT_SOLVER_PROGRESS_THROTTLE_MS),
);
const strictProgressValidationCostPerRunMs =
  strictProgressProfile.perCallMs * solveProgressMessagesPerRun;
const thresholdMs = medianElapsedMs * 0.02;
const shouldGateProgressValidation = strictProgressValidationCostPerRunMs > thresholdMs;
const decision = shouldGateProgressValidation
  ? 'Enable light-progress mode for high-frequency SOLVE_PROGRESS validation.'
  : 'Keep strict SOLVE_PROGRESS validation; gating is not justified by measured overhead.';

const report = `# Phase 4 Protocol Validation Profile

Generated: ${new Date().toISOString()}
Script: \`node tools/scripts/profile-worker-validation.mjs\`

## Scope

- Protocol version: v2
- Message focus: \`SOLVE_PROGRESS\` (high-frequency) and \`BENCH_RESULT\` (structural)
- Iterations per sample: ${ITERATIONS.toLocaleString()} (warmup ${WARMUP_ITERATIONS.toLocaleString()})

## Raw Measurements

| Measurement | Total elapsed (ms) | Per-call (ms) | Per-call (us) |
| --- | ---: | ---: | ---: |
| strict \`parseWorkerOutboundMessage(SOLVE_PROGRESS)\` | ${toFixed(strictProgressProfile.elapsedMs, 2)} | ${toFixed(strictProgressProfile.perCallMs)} | ${toFixed(strictProgressProfile.perCallUs, 2)} |
| light \`validateOutboundMessage(SOLVE_PROGRESS, { mode: "light-progress" })\` | ${toFixed(lightProgressProfile.elapsedMs, 2)} | ${toFixed(lightProgressProfile.perCallMs)} | ${toFixed(lightProgressProfile.perCallUs, 2)} |
| structural \`validateOutboundMessage(BENCH_RESULT, { mode: "light-progress" })\` | ${toFixed(structuralProfile.elapsedMs, 2)} | ${toFixed(structuralProfile.perCallMs)} | ${toFixed(structuralProfile.perCallUs, 2)} |

## Benchmark-Load Estimate

- Simulated benchmark elapsed samples (ms): ${simulatedBenchmarkElapsedSamplesMs.join(', ')}
- Median benchmark elapsed (ms): ${toFixed(medianElapsedMs, 2)}
- Solver throttle interval (ms): ${DEFAULT_SOLVER_PROGRESS_THROTTLE_MS}
- Estimated progress messages/run: ${solveProgressMessagesPerRun}
- Strict SOLVE_PROGRESS validation cost/run (ms): ${toFixed(strictProgressValidationCostPerRunMs, 4)}
- 2% threshold of median elapsed (ms): ${toFixed(thresholdMs, 4)}

## Decision

- Rule: only gate SOLVE_PROGRESS validation if strict validation cost > 2% of median benchmark elapsed.
- Outcome: ${decision}
- Structural messages remain strictly validated in all modes.
`;

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, report, 'utf8');

console.log(`Worker validation profile written to ${path.relative(repoRoot, outputPath)}`);
console.log(
  `Strict SOLVE_PROGRESS cost/run: ${toFixed(strictProgressValidationCostPerRunMs, 4)}ms (threshold ${toFixed(thresholdMs, 4)}ms)`,
);
