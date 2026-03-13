import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildAnalyzeLevelTraceScenarioReport,
  readTraceEventsFromFile,
  renderAnalyzeLevelTraceReport,
  type TraceEvent,
  writeAnalyzeLevelTraceReport,
} from '../analyzeLevelTraceReport';

function createTraceEvents(): TraceEvent[] {
  return [
    {
      args: { name: 'CrRendererMain' },
      name: 'thread_name',
      ph: 'M',
      pid: 1,
      tid: 10,
      ts: 0,
    },
    {
      args: { name: 'Renderer' },
      name: 'process_name',
      ph: 'M',
      pid: 1,
      tid: 0,
      ts: 0,
    },
    {
      dur: 80_000,
      name: 'EventDispatch',
      ph: 'X',
      pid: 1,
      tid: 10,
      ts: 0,
    },
    {
      args: {
        data: {
          functionName: 'analyzeLevel',
        },
      },
      dur: 60_000,
      name: 'FunctionCall',
      ph: 'X',
      pid: 1,
      tid: 10,
      ts: 1_000,
    },
    {
      args: {
        data: {
          functionName: 'compileLevel',
        },
      },
      dur: 20_000,
      name: 'FunctionCall',
      ph: 'X',
      pid: 1,
      tid: 10,
      ts: 2_000,
    },
    {
      args: {
        data: {
          cpuProfile: {
            nodes: [
              {
                callFrame: {
                  codeType: 'other',
                  functionName: '(root)',
                },
                id: 1,
              },
              {
                callFrame: {
                  codeType: 'JS',
                  functionName: 'analyzeLevel',
                },
                id: 2,
                parent: 1,
              },
              {
                callFrame: {
                  codeType: 'JS',
                  functionName: 'compileLevel',
                },
                id: 3,
                parent: 2,
              },
              {
                callFrame: {
                  codeType: 'JS',
                  functionName: 'buildGoalDistances',
                },
                id: 4,
                parent: 3,
              },
            ],
            samples: [4, 3, 2],
          },
          timeDeltas: [2_000, 3_000, 5_000],
        },
      },
      name: 'ProfileChunk',
      ph: 'P',
      pid: 1,
      tid: 99,
      ts: 3_000,
    },
  ];
}

describe('analyzeLevelTraceReport', () => {
  let tempDir = '';

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('extracts outer long tasks, long function calls, and target cpu samples', () => {
    const report = buildAnalyzeLevelTraceScenarioReport(
      'play-level-handoff.trace.json',
      createTraceEvents(),
    );

    expect(report.mainThreadName).toBe('CrRendererMain');
    expect(report.longTaskCount).toBe(1);
    expect(report.longTasks[0]).toMatchObject({
      name: 'EventDispatch',
      durationMs: 80,
    });
    expect(report.longFunctionCalls[0]).toMatchObject({
      functionName: 'analyzeLevel',
      durationMs: 60,
    });
    expect(report.totalBlockingTimeMs).toBe(30);
    expect(report.targetFunctionSamples).toEqual([
      {
        functionName: 'analyzeLevel',
        sampleCount: 1,
        selfTimeMs: 5,
        totalTimeMs: 10,
      },
      {
        functionName: 'compileLevel',
        sampleCount: 1,
        selfTimeMs: 3,
        totalTimeMs: 5,
      },
      {
        functionName: 'buildGoalDistances',
        sampleCount: 1,
        selfTimeMs: 2,
        totalTimeMs: 2,
      },
    ]);
  });

  it('renders a markdown report with scenario summaries and sampled function tables', () => {
    const scenario = buildAnalyzeLevelTraceScenarioReport(
      'lab-run-solve.trace.json',
      createTraceEvents(),
    );
    const markdown = renderAnalyzeLevelTraceReport([scenario]);

    expect(markdown).toContain('# AnalyzeLevel Trace Report');
    expect(markdown).toContain('## lab-run-solve.trace.json');
    expect(markdown).toContain('| Start (ms) | Duration (ms) | Event | Function |');
    expect(markdown).toContain('| analyzeLevel | 5.00 | 10.00 | 1 |');
    expect(markdown).toContain('| compileLevel | 3.00 | 5.00 | 1 |');
  });

  it('falls back to the busiest thread when no CrRendererMain thread is named', () => {
    const report = buildAnalyzeLevelTraceScenarioReport(
      'fallback.trace.json',
      createTraceEvents().map((event) =>
        event.name === 'thread_name' ? { ...event, args: { name: 'WorkerThread' } } : event,
      ),
    );

    expect(report.mainThreadName).toBe('WorkerThread');
    expect(report.longTaskCount).toBe(1);
  });

  it('renders empty-state sections when no long tasks or sampled functions exist', () => {
    const scenario = buildAnalyzeLevelTraceScenarioReport('empty.trace.json', [
      { name: 'thread_name', ph: 'M', pid: 1, tid: 2, ts: 0, args: { name: 'WorkerThread' } },
    ]);

    expect(scenario.longTasks).toEqual([]);
    expect(scenario.sampledFunctions).toEqual([]);
    expect(
      renderAnalyzeLevelTraceReport([scenario], { targetFunctionNames: ['customFn'] }),
    ).toContain('No long tasks crossed the configured threshold.');
    expect(renderAnalyzeLevelTraceReport([], { targetFunctionNames: ['customFn'] })).toContain(
      'No trace files were available for report generation.',
    );
  });

  it('reads trace events from disk and writes sorted scenario reports', () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'corgiban-trace-report-'));
    const firstTracePath = path.join(tempDir, 'b.trace.json');
    const secondTracePath = path.join(tempDir, 'a.trace.json');
    writeFileSync(firstTracePath, JSON.stringify({ traceEvents: createTraceEvents() }), 'utf8');
    writeFileSync(secondTracePath, JSON.stringify({ traceEvents: createTraceEvents() }), 'utf8');

    expect(readTraceEventsFromFile(firstTracePath)).toHaveLength(createTraceEvents().length);

    const outputPath = path.join(tempDir, 'report.md');
    const reports = writeAnalyzeLevelTraceReport({
      inputDir: tempDir,
      outputPath,
    });

    expect(reports.map((report) => report.traceName)).toEqual(['a.trace.json', 'b.trace.json']);
  });

  it('rejects trace files without a traceEvents array', () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'corgiban-trace-invalid-'));
    const invalidTracePath = path.join(tempDir, 'invalid.trace.json');
    writeFileSync(invalidTracePath, JSON.stringify({ events: [] }), 'utf8');

    expect(() => readTraceEventsFromFile(invalidTracePath)).toThrow(
      'does not contain a traceEvents array',
    );
  });

  it('tolerates malformed metadata and CPU samples while preserving fallback summaries', () => {
    const scenario = buildAnalyzeLevelTraceScenarioReport(
      'malformed.trace.json',
      [
        {
          args: { name: 42 },
          name: 'thread_name',
          ph: 'M',
          pid: 1,
          tid: 2,
          ts: 0,
        },
        {
          args: { name: 'MissingTid' },
          name: 'thread_name',
          ph: 'M',
          pid: 1,
          ts: 0,
        },
        {
          dur: 60_000,
          name: 'EventDispatch',
          ph: 'X',
          pid: 7,
          tid: 8,
          ts: 0,
        },
        {
          dur: 55_000,
          name: 'EventDispatch',
          ph: 'X',
          pid: 7,
          tid: 8,
          ts: 0,
        },
        {
          dur: 70_000,
          ph: 'X',
          pid: 7,
          tid: 8,
          ts: 10_000,
        },
        {
          args: {},
          dur: 60_000,
          name: 'FunctionCall',
          ph: 'X',
          pid: 7,
          tid: 8,
          ts: 20_000,
        },
        {
          args: {
            data: 'bad-data',
          },
          name: 'ProfileChunk',
          ph: 'P',
          pid: 7,
          tid: 8,
          ts: 30_000,
        },
        {
          args: {
            data: {
              cpuProfile: {
                samples: [99],
              },
            },
          },
          name: 'ProfileChunk',
          ph: 'P',
          pid: 7,
          tid: 8,
          ts: 31_000,
        },
        {
          args: {
            data: {
              cpuProfile: {
                nodes: [
                  {
                    callFrame: {
                      codeType: 'JS',
                      functionName: 'ancestorOnly',
                    },
                    id: 1,
                  },
                  {
                    callFrame: {
                      codeType: 'JS',
                      functionName: 'leafWorker',
                    },
                    id: 2,
                    parent: 1,
                  },
                  {
                    callFrame: {
                      codeType: 'JS',
                      functionName: '   ',
                    },
                    id: 3,
                  },
                  {
                    callFrame: {
                      codeType: 'CPP',
                      functionName: 'nativeFrame',
                    },
                    id: 4,
                  },
                ],
                samples: [2, 3, 4, 'bad-node-id'],
              },
              timeDeltas: [1_000, 2_000, 3_000, 'bad-delta'],
            },
          },
          name: 'ProfileChunk',
          ph: 'P',
          pid: 7,
          tid: 8,
          ts: 32_000,
        },
      ] as TraceEvent[],
      {
        targetFunctionNames: ['ancestorOnly', 'leafWorker'],
        topFunctionCount: 5,
      },
    );

    expect(scenario.mainThreadName).toBe('unknown');
    expect(scenario.longTaskCount).toBe(2);
    expect(scenario.longFunctionCalls[0]).toMatchObject({
      functionName: null,
      threadName: 'unknown',
    });
    expect(scenario.sampledFunctions).toEqual(
      expect.arrayContaining([
        {
          functionName: 'ancestorOnly',
          sampleCount: 0,
          selfTimeMs: 0,
          totalTimeMs: 1,
        },
        {
          functionName: 'leafWorker',
          sampleCount: 1,
          selfTimeMs: 1,
          totalTimeMs: 1,
        },
      ]),
    );
    expect(
      renderAnalyzeLevelTraceReport([scenario], { targetFunctionNames: ['ancestorOnly'] }),
    ).toContain('| ancestorOnly | 0.00 | 1.00 | 0 |');
  });
});
