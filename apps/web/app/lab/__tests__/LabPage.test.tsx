// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LabPage } from '../LabPage';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

const mocks = vi.hoisted(() => {
  const solverPort = {
    startSolve: vi.fn(),
    cancelSolve: vi.fn(),
    pingWorker: vi.fn(),
    retryWorker: vi.fn(),
    getWorkerHealth: vi.fn(() => 'idle'),
    subscribeWorkerHealth: vi.fn(() => () => undefined),
    dispose: vi.fn(),
  };
  const benchmarkPort = {
    runSuite: vi.fn(),
    cancelSuite: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    solverPort,
    benchmarkPort,
    createSolverPort: vi.fn(() => solverPort),
    createBenchmarkPort: vi.fn(() => benchmarkPort),
    importTextFile: vi.fn(),
    exportTextFile: vi.fn(),
    runIdCounter: 0,
  };
});

vi.mock('../../canvas/GameCanvas', () => ({
  GameCanvas: ({ state }: { state: { stats: { moves: number; pushes: number } } }) => {
    return (
      <div data-testid="canvas-state">
        canvas:{state.stats.moves}:{state.stats.pushes}
      </div>
    );
  },
}));

vi.mock('../../ports/solverPort.client', () => ({
  createSolverPort: mocks.createSolverPort,
}));

vi.mock('../../ports/benchmarkPort.client', () => ({
  createBenchmarkPort: mocks.createBenchmarkPort,
}));

vi.mock('../../bench/fileAccess.client', () => ({
  importTextFile: mocks.importTextFile,
  exportTextFile: mocks.exportTextFile,
}));

vi.mock('../../runId', () => ({
  makeRunId: (prefix: string) => {
    mocks.runIdCounter += 1;
    return `${prefix}-${mocks.runIdCounter}`;
  },
}));

const mountedRoots: Root[] = [];

function makeSolverResult(solutionMoves: string) {
  return {
    runId: 'ignored-run-id',
    algorithmId: 'bfsPush' as const,
    status: 'solved' as const,
    solutionMoves,
    metrics: {
      elapsedMs: 5,
      expanded: 3,
      generated: 4,
      maxDepth: 2,
      maxFrontier: 2,
      pushCount: 1,
      moveCount: solutionMoves.length,
    },
  };
}

function makeBenchRecord() {
  return {
    id: 'bench-result-1',
    suiteRunId: 'lab-bench-suite-1',
    runId: 'lab-bench-suite-1',
    sequence: 1,
    levelId: 'lab-level',
    algorithmId: 'bfsPush' as const,
    repetition: 1,
    warmup: false,
    options: {
      timeBudgetMs: 30_000,
      nodeBudget: 2_000_000,
    },
    status: 'solved' as const,
    metrics: {
      elapsedMs: 8,
      expanded: 4,
      generated: 5,
      maxDepth: 2,
      maxFrontier: 2,
      pushCount: 1,
      moveCount: 2,
    },
    startedAtMs: 1,
    finishedAtMs: 9,
    environment: {
      userAgent: 'test',
      hardwareConcurrency: 4,
      appVersion: 'test',
    },
    comparableMetadata: {
      solver: {
        algorithmId: 'bfsPush' as const,
        timeBudgetMs: 30_000,
        nodeBudget: 2_000_000,
      },
      environment: {
        userAgent: 'test',
        hardwareConcurrency: 4,
        appVersion: 'test',
      },
      warmupEnabled: false,
      warmupRepetitions: 0,
    },
  };
}

async function renderPage() {
  const container = document.createElement('div');
  document.body.append(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<LabPage />);
  });

  return { container, root };
}

async function unmountRoot(root: Root) {
  const rootIndex = mountedRoots.indexOf(root);
  if (rootIndex >= 0) {
    mountedRoots.splice(rootIndex, 1);
  }

  await act(async () => {
    root.unmount();
  });
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((item) => {
    return item.textContent?.includes(label);
  });

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

function findTextarea(container: HTMLElement): HTMLTextAreaElement {
  const textarea = container.querySelector('textarea');
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error('Textarea not found.');
  }
  return textarea;
}

async function setTextareaValue(container: HTMLElement, value: string) {
  const textarea = findTextarea(container);
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    valueSetter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function clickButton(container: HTMLElement, label: string) {
  await act(async () => {
    findButton(container, label).click();
  });
}

async function dispatchKeyDown(code: string) {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.runIdCounter = 0;
  mocks.createSolverPort.mockReset();
  mocks.createSolverPort.mockImplementation(() => mocks.solverPort);
  mocks.createBenchmarkPort.mockReset();
  mocks.createBenchmarkPort.mockImplementation(() => mocks.benchmarkPort);
  mocks.importTextFile.mockReset();
  mocks.exportTextFile.mockReset();
  mocks.solverPort.startSolve.mockReset();
  mocks.solverPort.cancelSolve.mockReset();
  mocks.solverPort.pingWorker.mockReset();
  mocks.solverPort.retryWorker.mockReset();
  mocks.solverPort.getWorkerHealth.mockImplementation(() => 'idle');
  mocks.solverPort.subscribeWorkerHealth.mockImplementation(() => () => undefined);
  mocks.solverPort.dispose.mockReset();
  mocks.benchmarkPort.runSuite.mockReset();
  mocks.benchmarkPort.cancelSuite.mockReset();
  mocks.benchmarkPort.dispose.mockReset();
});

afterEach(async () => {
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop();
    await act(async () => {
      root?.unmount();
    });
  }

  document.body.innerHTML = '';
});

describe('LabPage', () => {
  it.each([
    ['a non-object import payload', 'null', 'Lab import payload must be a JSON object.'],
    [
      'an unsupported import type',
      JSON.stringify({
        type: 'other-lab-level',
        version: 1,
        format: 'xsb',
        content: '#####\n#@$.#\n#####',
      }),
      'Unsupported lab import payload type.',
    ],
    [
      'an unsupported import version',
      JSON.stringify({
        type: 'corgiban-lab-level',
        version: 2,
        format: 'xsb',
        content: '#####\n#@$.#\n#####',
      }),
      'Unsupported lab import payload version.',
    ],
    [
      'an unsupported import format',
      JSON.stringify({
        type: 'corgiban-lab-level',
        version: 1,
        format: 'yaml',
        content: '#####\n#@$.#\n#####',
      }),
      'Unsupported lab format in import payload.',
    ],
    [
      'an import payload without text content',
      JSON.stringify({
        type: 'corgiban-lab-level',
        version: 1,
        format: 'xsb',
      }),
      'Lab import payload is missing textual content.',
    ],
  ])('shows a readable error for %s', async (_label, content, expectedMessage) => {
    mocks.importTextFile.mockResolvedValueOnce({ content });

    const { container } = await renderPage();

    await clickButton(container, 'Import JSON');
    await flushPromises();

    expect(container.textContent).toContain(expectedMessage);
  });

  it('surfaces file-picker import failures', async () => {
    mocks.importTextFile.mockRejectedValueOnce(new Error('Picker dismissed.'));

    const { container } = await renderPage();

    await clickButton(container, 'Import JSON');
    await flushPromises();

    expect(container.textContent).toContain('Picker dismissed.');
  });

  it('disposes both owned ports when the page unmounts', async () => {
    const { root } = await renderPage();

    expect(mocks.createSolverPort).toHaveBeenCalledTimes(1);
    expect(mocks.createBenchmarkPort).toHaveBeenCalledTimes(1);
    expect(mocks.solverPort.dispose).not.toHaveBeenCalled();
    expect(mocks.benchmarkPort.dispose).not.toHaveBeenCalled();

    await unmountRoot(root);

    expect(mocks.solverPort.dispose).toHaveBeenCalledTimes(1);
    expect(mocks.benchmarkPort.dispose).toHaveBeenCalledTimes(1);
  });

  it('exports the current lab payload through the file-access adapter', async () => {
    mocks.exportTextFile.mockResolvedValueOnce(undefined);

    const { container } = await renderPage();
    const customInput = ['#####', '#@$.#', '#####'].join('\n');
    await setTextareaValue(container, customInput);

    await clickButton(container, 'Export JSON');
    await flushPromises();

    expect(mocks.exportTextFile).toHaveBeenCalledTimes(1);
    const call = mocks.exportTextFile.mock.calls[0]?.[0];
    expect(call?.suggestedName).toBe('corgiban-lab-level.json');

    const payload = JSON.parse(call?.content ?? '{}');
    expect(payload).toEqual(
      expect.objectContaining({
        type: 'corgiban-lab-level',
        version: 1,
        format: 'xsb',
        content: customInput,
      }),
    );
    expect(typeof payload.exportedAtIso).toBe('string');
  });

  it.each([
    ['sok-0.17', 'Title: Imported\n#####\n#.@ #\n# $ #\n# . #\n#####', 'Title: Imported'],
    [
      'slc-xml',
      '<?xml version="1.0" encoding="UTF-8"?>\n<Collection>\n  <Level Id="imported" Name="Imported">\n    <L>#####</L>\n    <L>#.@ #</L>\n    <L># $ #</L>\n    <L># . #</L>\n    <L>#####</L>\n  </Level>\n</Collection>',
      '<Collection>',
    ],
  ])(
    'preserves %s format intent across import and export',
    async (format, content, expectedContentSnippet) => {
      mocks.importTextFile.mockResolvedValueOnce({
        content: JSON.stringify({
          type: 'corgiban-lab-level',
          version: 1,
          format,
          content,
        }),
      });
      mocks.exportTextFile.mockResolvedValueOnce(undefined);

      const { container } = await renderPage();

      await clickButton(container, 'Import JSON');
      await flushPromises();
      await clickButton(container, 'Export JSON');
      await flushPromises();

      const exportedPayload = JSON.parse(mocks.exportTextFile.mock.calls[0]?.[0]?.content ?? '{}');
      expect(exportedPayload).toEqual(
        expect.objectContaining({
          format,
          content: expect.stringContaining(expectedContentSnippet),
        }),
      );
    },
  );

  it('surfaces export failures', async () => {
    mocks.exportTextFile.mockRejectedValueOnce(new Error('Disk full.'));

    const { container } = await renderPage();

    await clickButton(container, 'Export JSON');
    await flushPromises();

    expect(container.textContent).toContain('Disk full.');
  });

  it('updates solve progress while running and renders the completed solution', async () => {
    const deferredSolve = createDeferred<ReturnType<typeof makeSolverResult>>();
    mocks.solverPort.startSolve.mockImplementationOnce(({ onProgress }) => {
      onProgress?.({
        expanded: 9,
        generated: 11,
        elapsedMs: 4.5,
      });
      return deferredSolve.promise;
    });

    const { container } = await renderPage();

    await clickButton(container, 'Run solve');

    expect(container.textContent).toContain('running');
    expect(container.textContent).toContain('expanded=9 generated=11 elapsed=4.5 ms');

    deferredSolve.resolve(makeSolverResult('R'));
    await flushPromises();

    expect(container.textContent).toContain('solved (5.0 ms)');
    expect((container.querySelector('input[readonly]') as HTMLInputElement | null)?.value).toBe(
      'R',
    );
  });

  it('surfaces cancelled solve results returned by the worker', async () => {
    mocks.solverPort.startSolve.mockResolvedValueOnce({
      ...makeSolverResult(''),
      status: 'cancelled',
      solutionMoves: undefined,
    });

    const { container } = await renderPage();

    await clickButton(container, 'Run solve');
    await flushPromises();

    expect(container.textContent).toContain('cancelled: Solver run cancelled.');
    expect(container.textContent).not.toContain('failed:');
  });

  it('surfaces cancelled solve errors without treating them as failures', async () => {
    mocks.solverPort.startSolve.mockRejectedValueOnce(
      Object.assign(new Error('Worker cancelled solve.'), {
        name: 'SolverRunCancelledError',
      }),
    );

    const { container } = await renderPage();

    await clickButton(container, 'Run solve');
    await flushPromises();

    expect(container.textContent).toContain('cancelled: Worker cancelled solve.');
    expect(container.textContent).not.toContain('failed:');
  });

  it('surfaces generic solve failures', async () => {
    mocks.solverPort.startSolve.mockRejectedValueOnce(new Error('Solver exploded.'));

    const { container } = await renderPage();

    await clickButton(container, 'Run solve');
    await flushPromises();

    expect(container.textContent).toContain('failed: Solver exploded.');
  });

  it('replays applied solutions from the authored level reset state, not the live preview state', async () => {
    mocks.solverPort.startSolve.mockResolvedValueOnce(makeSolverResult('RR'));

    const { container } = await renderPage();
    await setTextareaValue(container, ['#######', '#@ $. #', '#     #', '#######'].join('\n'));

    await act(async () => {
      findButton(container, 'Parse Level').click();
    });

    await dispatchKeyDown('ArrowDown');
    expect(container.textContent).toContain('Moves: 1 | Pushes: 0');

    await act(async () => {
      findButton(container, 'Run solve').click();
    });
    await flushPromises();

    await act(async () => {
      findButton(container, 'Apply solution').click();
    });

    expect(container.textContent).toContain('Moves: 2 | Pushes: 1');
  });

  it('cancels in-flight solves when a new parse is applied and ignores stale solve completions', async () => {
    const deferredSolve = createDeferred<ReturnType<typeof makeSolverResult>>();
    mocks.solverPort.startSolve.mockReturnValueOnce(deferredSolve.promise);

    const { container } = await renderPage();

    await clickButton(container, 'Run solve');

    await setTextareaValue(container, ['#####', '#@$.#', '#####'].join('\n'));
    await clickButton(container, 'Parse Level');

    expect(mocks.solverPort.cancelSolve).toHaveBeenCalledWith('lab-solve-1');
    expect(container.textContent).toContain('Solve status');
    expect(container.textContent).toContain('idle');

    deferredSolve.resolve(makeSolverResult('R'));
    await flushPromises();

    expect(container.textContent).toContain('idle');
    expect(container.textContent).not.toContain('solved (5.0 ms)');
    expect(container.querySelector('input[readonly]')).toBeNull();
  });

  it('surfaces a user cancel as cancelled instead of failed', async () => {
    const deferredSolve = createDeferred<ReturnType<typeof makeSolverResult>>();
    mocks.solverPort.startSolve.mockReturnValueOnce(deferredSolve.promise);

    const { container } = await renderPage();

    await clickButton(container, 'Run solve');

    await clickButton(container, 'Cancel solve');

    expect(mocks.solverPort.cancelSolve).toHaveBeenCalledWith('lab-solve-1');
    expect(container.textContent).toContain('cancelled: Solver run cancelled by user.');
    expect(container.textContent).not.toContain('failed:');

    deferredSolve.reject(
      Object.assign(new Error('Solver run cancelled by user.'), {
        name: 'SolverRunCancelledError',
      }),
    );
    await flushPromises();

    expect(container.textContent).toContain('cancelled: Solver run cancelled by user.');
  });

  it('cancels in-flight bench runs on import and ignores stale bench completions', async () => {
    const deferredBench = createDeferred<ReturnType<typeof makeBenchRecord>[]>();
    mocks.benchmarkPort.runSuite.mockReturnValueOnce(deferredBench.promise);
    mocks.importTextFile.mockResolvedValueOnce({
      content: JSON.stringify({
        type: 'corgiban-lab-level',
        version: 1,
        format: 'xsb',
        content: ['#####', '#@$.#', '#####'].join('\n'),
      }),
    });

    const { container } = await renderPage();

    await clickButton(container, 'Run bench');

    await clickButton(container, 'Import JSON');
    await flushPromises();

    expect(mocks.benchmarkPort.cancelSuite).toHaveBeenCalledWith('lab-bench-suite-1');
    expect(container.textContent).toContain('Imported lab payload.');
    expect(container.textContent).toContain('Bench status');
    expect(container.textContent).toContain('idle');

    deferredBench.resolve([makeBenchRecord()]);
    await flushPromises();

    expect(container.textContent).toContain('idle');
    expect(container.textContent).not.toContain('runId=lab-bench-suite-1');
  });

  it('renders bench completion details when a run succeeds', async () => {
    mocks.benchmarkPort.runSuite.mockResolvedValueOnce([makeBenchRecord()]);

    const { container } = await renderPage();

    await clickButton(container, 'Run bench');
    await flushPromises();

    expect(container.textContent).toContain('solved (8.0 ms)');
    expect(container.textContent).toContain('runId=lab-bench-suite-1 expanded=4 generated=5');
  });

  it('surfaces a cancelled benchmark result returned by the worker', async () => {
    mocks.benchmarkPort.runSuite.mockResolvedValueOnce([
      {
        ...makeBenchRecord(),
        status: 'cancelled',
      },
    ]);

    const { container } = await renderPage();

    await clickButton(container, 'Run bench');
    await flushPromises();

    expect(container.textContent).toContain('cancelled: Benchmark run cancelled.');
    expect(container.textContent).not.toContain('failed:');
  });

  it('surfaces benchmark cancellation errors without treating them as failures', async () => {
    mocks.benchmarkPort.runSuite.mockRejectedValueOnce(
      Object.assign(new Error('Worker cancelled bench.'), {
        name: 'BenchmarkRunCancelledError',
      }),
    );

    const { container } = await renderPage();

    await clickButton(container, 'Run bench');
    await flushPromises();

    expect(container.textContent).toContain('cancelled: Worker cancelled bench.');
    expect(container.textContent).not.toContain('failed:');
  });

  it('surfaces an empty benchmark result set as a failure', async () => {
    mocks.benchmarkPort.runSuite.mockResolvedValueOnce([]);

    const { container } = await renderPage();

    await clickButton(container, 'Run bench');
    await flushPromises();

    expect(container.textContent).toContain('failed: Benchmark run did not return a result.');
  });

  it('surfaces generic benchmark failures', async () => {
    mocks.benchmarkPort.runSuite.mockRejectedValueOnce(new Error('Bench exploded.'));

    const { container } = await renderPage();

    await clickButton(container, 'Run bench');
    await flushPromises();

    expect(container.textContent).toContain('failed: Bench exploded.');
  });

  it('resets preview state from both keyboard and button reset actions', async () => {
    const { container } = await renderPage();
    await setTextareaValue(container, ['#######', '#@ $. #', '#     #', '#######'].join('\n'));

    await clickButton(container, 'Parse Level');

    await dispatchKeyDown('ArrowDown');
    expect(container.textContent).toContain('Moves: 1 | Pushes: 0');

    await dispatchKeyDown('KeyR');
    expect(container.textContent).toContain('Moves: 0 | Pushes: 0');

    await dispatchKeyDown('ArrowDown');
    expect(container.textContent).toContain('Moves: 1 | Pushes: 0');

    await clickButton(container, 'Reset preview');
    expect(container.textContent).toContain('Moves: 0 | Pushes: 0');
  });
});
