import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type TraceArgs = Record<string, unknown> | undefined;

export type TraceEvent = {
  args?: TraceArgs;
  cat?: string;
  dur?: number;
  name?: string;
  ph?: string;
  pid?: number;
  tid?: number;
  ts?: number;
};

export type LongTaskSummary = {
  durationMs: number;
  endMs: number;
  functionName: string | null;
  name: string;
  startMs: number;
  threadName: string;
};

export type CpuFunctionSummary = {
  functionName: string;
  sampleCount: number;
  selfTimeMs: number;
  totalTimeMs: number;
};

export type AnalyzeLevelTraceScenarioReport = {
  longFunctionCalls: LongTaskSummary[];
  longTaskCount: number;
  longTasks: LongTaskSummary[];
  mainThreadName: string;
  maxLongTaskMs: number;
  sampledFunctions: CpuFunctionSummary[];
  targetFunctionSamples: CpuFunctionSummary[];
  totalBlockingTimeMs: number;
  totalLongTaskTimeMs: number;
  traceName: string;
};

export type AnalyzeLevelTraceReportOptions = {
  longTaskThresholdMs?: number;
  targetFunctionNames?: string[];
  topFunctionCount?: number;
};

type CpuProfileNode = {
  callFrame?: {
    codeType?: string;
    functionName?: string;
  };
  id: number;
  parent?: number;
};

const DEFAULT_LONG_TASK_THRESHOLD_MS = 50;
const DEFAULT_TARGET_FUNCTION_NAMES = ['analyzeLevel', 'compileLevel', 'buildGoalDistances'];
const DEFAULT_TOP_FUNCTION_COUNT = 10;

function getThreadName(event: TraceEvent): string | null {
  if (event.ph !== 'M' || event.name !== 'thread_name') {
    return null;
  }

  const args = event.args;
  const name = args && typeof args.name === 'string' ? args.name : null;
  return name;
}

function getFunctionNameFromEvent(event: TraceEvent): string | null {
  const args = event.args;
  const data =
    args && typeof args === 'object' && args.data && typeof args.data === 'object'
      ? (args.data as Record<string, unknown>)
      : null;
  const functionName = data && typeof data.functionName === 'string' ? data.functionName : null;
  return functionName;
}

function formatDurationMs(valueUs: number): number {
  return valueUs / 1000;
}

function createThreadNameMap(traceEvents: TraceEvent[]): Map<string, string> {
  const threadNames = new Map<string, string>();

  for (const event of traceEvents) {
    if (typeof event.pid !== 'number' || typeof event.tid !== 'number') {
      continue;
    }

    const threadName = getThreadName(event);
    if (!threadName) {
      continue;
    }

    threadNames.set(`${event.pid}:${event.tid}`, threadName);
  }

  return threadNames;
}

function findMainThreadKeys(traceEvents: TraceEvent[], threadNames: Map<string, string>): string[] {
  const mainThreadKeys = Array.from(threadNames.entries())
    .filter(([, name]) => name === 'CrRendererMain')
    .map(([key]) => key);

  if (mainThreadKeys.length > 0) {
    return mainThreadKeys;
  }

  const completeCounts = new Map<string, number>();
  for (const event of traceEvents) {
    if (event.ph !== 'X' || typeof event.pid !== 'number' || typeof event.tid !== 'number') {
      continue;
    }

    const key = `${event.pid}:${event.tid}`;
    completeCounts.set(key, (completeCounts.get(key) ?? 0) + 1);
  }

  const fallback = Array.from(completeCounts.entries()).sort(
    (left, right) => right[1] - left[1],
  )[0];
  return fallback ? [fallback[0]] : [];
}

function createLongTaskSummary(
  event: TraceEvent,
  threadNames: Map<string, string>,
): LongTaskSummary | null {
  if (
    typeof event.pid !== 'number' ||
    typeof event.tid !== 'number' ||
    typeof event.ts !== 'number' ||
    typeof event.dur !== 'number' ||
    typeof event.name !== 'string'
  ) {
    return null;
  }

  const threadName = threadNames.get(`${event.pid}:${event.tid}`) ?? 'unknown';
  const startMs = formatDurationMs(event.ts);
  const durationMs = formatDurationMs(event.dur);

  return {
    durationMs,
    endMs: startMs + durationMs,
    functionName: getFunctionNameFromEvent(event),
    name: event.name,
    startMs,
    threadName,
  };
}

function isContainedIn(other: LongTaskSummary, candidate: LongTaskSummary): boolean {
  return (
    other.threadName === candidate.threadName &&
    other.startMs <= candidate.startMs &&
    other.endMs >= candidate.endMs &&
    (other.startMs < candidate.startMs || other.endMs > candidate.endMs)
  );
}

function extractLongTasks(
  traceEvents: TraceEvent[],
  threadNames: Map<string, string>,
  mainThreadKeys: string[],
  thresholdMs: number,
): LongTaskSummary[] {
  const thresholdUs = thresholdMs * 1000;
  const candidates = traceEvents
    .filter((event) => {
      if (
        event.ph !== 'X' ||
        typeof event.pid !== 'number' ||
        typeof event.tid !== 'number' ||
        typeof event.dur !== 'number'
      ) {
        return false;
      }

      return mainThreadKeys.includes(`${event.pid}:${event.tid}`) && event.dur >= thresholdUs;
    })
    .map((event) => createLongTaskSummary(event, threadNames))
    .filter((event): event is LongTaskSummary => !!event)
    .sort((left, right) => {
      if (left.startMs !== right.startMs) {
        return left.startMs - right.startMs;
      }
      return right.durationMs - left.durationMs;
    });

  return candidates.filter((candidate, index) => {
    return !candidates.some((other, otherIndex) => {
      if (otherIndex === index) {
        return false;
      }
      return isContainedIn(other, candidate);
    });
  });
}

function extractLongFunctionCalls(
  traceEvents: TraceEvent[],
  threadNames: Map<string, string>,
  mainThreadKeys: string[],
  thresholdMs: number,
): LongTaskSummary[] {
  const thresholdUs = thresholdMs * 1000;
  return traceEvents
    .filter((event) => {
      if (
        event.name !== 'FunctionCall' ||
        event.ph !== 'X' ||
        typeof event.pid !== 'number' ||
        typeof event.tid !== 'number' ||
        typeof event.dur !== 'number'
      ) {
        return false;
      }

      return mainThreadKeys.includes(`${event.pid}:${event.tid}`) && event.dur >= thresholdUs;
    })
    .map((event) => createLongTaskSummary(event, threadNames))
    .filter((event): event is LongTaskSummary => !!event)
    .sort((left, right) => right.durationMs - left.durationMs);
}

function normalizeFunctionName(node: CpuProfileNode | undefined): string | null {
  const name = node?.callFrame?.functionName?.trim();
  if (!name) {
    return null;
  }
  return name;
}

function isRelevantSampledFunction(node: CpuProfileNode | undefined): boolean {
  const functionName = normalizeFunctionName(node);
  if (!functionName) {
    return false;
  }

  if (functionName === '(root)' || functionName === '(program)' || functionName === '(idle)') {
    return false;
  }

  return node?.callFrame?.codeType === 'JS';
}

function extractCpuFunctionSummaries(traceEvents: TraceEvent[]): CpuFunctionSummary[] {
  const nodeById = new Map<number, CpuProfileNode>();
  const selfTimeByFunction = new Map<string, number>();
  const totalTimeByFunction = new Map<string, number>();
  const sampleCountByFunction = new Map<string, number>();

  for (const event of traceEvents) {
    if (event.name !== 'ProfileChunk') {
      continue;
    }

    const args = event.args;
    const data =
      args && typeof args === 'object' && args.data && typeof args.data === 'object'
        ? (args.data as Record<string, unknown>)
        : null;
    const cpuProfile =
      data && typeof data.cpuProfile === 'object' && data.cpuProfile && 'samples' in data.cpuProfile
        ? (data.cpuProfile as { nodes?: CpuProfileNode[]; samples?: number[] })
        : null;
    const timeDeltas = Array.isArray(data?.timeDeltas) ? data.timeDeltas : [];

    for (const node of cpuProfile?.nodes ?? []) {
      nodeById.set(node.id, node);
    }

    const samples = cpuProfile?.samples ?? [];
    const sampleCount = Math.min(samples.length, timeDeltas.length);
    for (let index = 0; index < sampleCount; index += 1) {
      const nodeId = samples[index];
      const timeDelta = timeDeltas[index];
      if (typeof nodeId !== 'number' || typeof timeDelta !== 'number') {
        continue;
      }

      const durationMs = formatDurationMs(timeDelta);
      let cursor: CpuProfileNode | undefined = nodeById.get(nodeId);
      let isLeaf = true;

      while (cursor) {
        if (!isRelevantSampledFunction(cursor)) {
          cursor = typeof cursor.parent === 'number' ? nodeById.get(cursor.parent) : undefined;
          continue;
        }

        const functionName = normalizeFunctionName(cursor);
        if (!functionName) {
          break;
        }

        totalTimeByFunction.set(
          functionName,
          (totalTimeByFunction.get(functionName) ?? 0) + durationMs,
        );
        if (isLeaf) {
          selfTimeByFunction.set(
            functionName,
            (selfTimeByFunction.get(functionName) ?? 0) + durationMs,
          );
          sampleCountByFunction.set(
            functionName,
            (sampleCountByFunction.get(functionName) ?? 0) + 1,
          );
          isLeaf = false;
        }

        cursor = typeof cursor.parent === 'number' ? nodeById.get(cursor.parent) : undefined;
      }
    }
  }

  return Array.from(totalTimeByFunction.entries())
    .map(([functionName, totalTimeMs]) => ({
      functionName,
      sampleCount: sampleCountByFunction.get(functionName) ?? 0,
      selfTimeMs: selfTimeByFunction.get(functionName) ?? 0,
      totalTimeMs,
    }))
    .sort((left, right) => right.totalTimeMs - left.totalTimeMs);
}

function summarizeTargetFunctions(
  sampledFunctions: CpuFunctionSummary[],
  targetFunctionNames: string[],
): CpuFunctionSummary[] {
  return sampledFunctions.filter((entry) =>
    targetFunctionNames.some((target) => entry.functionName.includes(target)),
  );
}

function toFixed(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function renderLongTaskTable(longTasks: LongTaskSummary[]): string {
  if (longTasks.length === 0) {
    return 'No long tasks crossed the configured threshold.\n';
  }

  const rows = longTasks
    .map(
      (task) =>
        `| ${toFixed(task.startMs)} | ${toFixed(task.durationMs)} | ${task.name} | ${task.functionName ?? '-'} |`,
    )
    .join('\n');

  return `| Start (ms) | Duration (ms) | Event | Function |\n| ---: | ---: | --- | --- |\n${rows}\n`;
}

function renderCpuFunctionTable(sampledFunctions: CpuFunctionSummary[]): string {
  if (sampledFunctions.length === 0) {
    return 'No sampled JS functions were extracted from the trace.\n';
  }

  const rows = sampledFunctions
    .map(
      (entry) =>
        `| ${entry.functionName} | ${toFixed(entry.selfTimeMs)} | ${toFixed(entry.totalTimeMs)} | ${entry.sampleCount} |`,
    )
    .join('\n');

  return `| Function | Self (ms) | Inclusive (ms) | Samples |\n| --- | ---: | ---: | ---: |\n${rows}\n`;
}

export function buildAnalyzeLevelTraceScenarioReport(
  traceName: string,
  traceEvents: TraceEvent[],
  options: AnalyzeLevelTraceReportOptions = {},
): AnalyzeLevelTraceScenarioReport {
  const thresholdMs = options.longTaskThresholdMs ?? DEFAULT_LONG_TASK_THRESHOLD_MS;
  const targetFunctionNames = options.targetFunctionNames ?? DEFAULT_TARGET_FUNCTION_NAMES;
  const topFunctionCount = options.topFunctionCount ?? DEFAULT_TOP_FUNCTION_COUNT;
  const threadNames = createThreadNameMap(traceEvents);
  const mainThreadKeys = findMainThreadKeys(traceEvents, threadNames);
  const longTasks = extractLongTasks(traceEvents, threadNames, mainThreadKeys, thresholdMs);
  const longFunctionCalls = extractLongFunctionCalls(
    traceEvents,
    threadNames,
    mainThreadKeys,
    thresholdMs,
  );
  const allSampledFunctions = extractCpuFunctionSummaries(traceEvents);
  const sampledFunctions = allSampledFunctions.slice(0, topFunctionCount);
  const targetFunctionSamples = summarizeTargetFunctions(allSampledFunctions, targetFunctionNames);
  const totalLongTaskTimeMs = longTasks.reduce((total, entry) => total + entry.durationMs, 0);
  const totalBlockingTimeMs = longTasks.reduce(
    (total, entry) => total + Math.max(0, entry.durationMs - thresholdMs),
    0,
  );

  return {
    longFunctionCalls,
    longTaskCount: longTasks.length,
    longTasks,
    mainThreadName:
      mainThreadKeys
        .map((key) => threadNames.get(key))
        .filter((value): value is string => !!value)[0] ?? 'unknown',
    maxLongTaskMs: longTasks[0]?.durationMs ?? 0,
    sampledFunctions,
    targetFunctionSamples,
    totalBlockingTimeMs,
    totalLongTaskTimeMs,
    traceName,
  };
}

export function renderAnalyzeLevelTraceReport(
  scenarioReports: AnalyzeLevelTraceScenarioReport[],
  options: AnalyzeLevelTraceReportOptions = {},
): string {
  const thresholdMs = options.longTaskThresholdMs ?? DEFAULT_LONG_TASK_THRESHOLD_MS;
  const targetFunctionNames = options.targetFunctionNames ?? DEFAULT_TARGET_FUNCTION_NAMES;

  const scenarioSections =
    scenarioReports.length > 0
      ? scenarioReports
          .map((scenario) => {
            const longTaskTable = renderLongTaskTable(scenario.longTasks.slice(0, 10));
            const longFunctionCallTable = renderLongTaskTable(
              scenario.longFunctionCalls.slice(0, 10),
            );
            const targetFunctionTable = renderCpuFunctionTable(scenario.targetFunctionSamples);
            const sampledFunctionTable = renderCpuFunctionTable(scenario.sampledFunctions);

            return `## ${scenario.traceName}

- Main thread: ${scenario.mainThreadName}
- Long task threshold: ${thresholdMs} ms
- Long task count: ${scenario.longTaskCount}
- Total long-task time: ${toFixed(scenario.totalLongTaskTimeMs)} ms
- Total blocking time: ${toFixed(scenario.totalBlockingTimeMs)} ms
- Max long task: ${toFixed(scenario.maxLongTaskMs)} ms

### Long Tasks

${longTaskTable}

### Long Function Calls

${longFunctionCallTable}

### Target Function Samples

${targetFunctionTable}

### Top Sampled JS Functions

${sampledFunctionTable}`;
          })
          .join('\n\n')
      : 'No trace files were available for report generation.';

  return `# AnalyzeLevel Trace Report

Generated: ${new Date().toISOString()}

Target functions: ${targetFunctionNames.map((name) => `\`${name}\``).join(', ')}

${scenarioSections}
`;
}

export function readTraceEventsFromFile(tracePath: string): TraceEvent[] {
  const parsed = JSON.parse(readFileSync(tracePath, 'utf8')) as { traceEvents?: unknown };
  if (!Array.isArray(parsed.traceEvents)) {
    throw new Error(`Trace file ${tracePath} does not contain a traceEvents array.`);
  }

  return parsed.traceEvents as TraceEvent[];
}

export function writeAnalyzeLevelTraceReport({
  inputDir,
  outputPath,
  options,
}: {
  inputDir: string;
  options?: AnalyzeLevelTraceReportOptions;
  outputPath: string;
}): AnalyzeLevelTraceScenarioReport[] {
  const tracePaths = readdirSync(inputDir)
    .filter((entry) => entry.endsWith('.trace.json'))
    .map((entry) => path.resolve(inputDir, entry))
    .sort();

  const scenarioReports = tracePaths.map((tracePath) =>
    buildAnalyzeLevelTraceScenarioReport(
      path.basename(tracePath),
      readTraceEventsFromFile(tracePath),
      options,
    ),
  );

  writeFileSync(outputPath, renderAnalyzeLevelTraceReport(scenarioReports, options), 'utf8');
  return scenarioReports;
}
