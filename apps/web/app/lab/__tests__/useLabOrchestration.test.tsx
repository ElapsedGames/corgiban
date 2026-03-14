// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPlayableExactLevelKey } from '../../levels/playableIdentity';
import type { PlayableEntry } from '../../levels/temporaryLevelCatalog';
import { buildBenchHref, buildPlayHref } from '../../navigation/handoffLinks';
import { useLabOrchestration, type LabOrchestrationState } from '../useLabOrchestration';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const testState = vi.hoisted(() => ({
  latest: null as LabOrchestrationState | null,
  navigate: vi.fn(),
  upsertSessionPlayableEntry: vi.fn(),
  solverPortRef: { current: null as null | Record<string, unknown> },
  benchmarkPortRef: { current: null as null | Record<string, unknown> },
}));

vi.mock('@remix-run/react', () => ({
  useNavigate: () => testState.navigate,
}));

vi.mock('../../levels/temporaryLevelCatalog', () => ({
  upsertSessionPlayableEntry: testState.upsertSessionPlayableEntry,
}));

vi.mock('../useLabOwnedPorts', () => ({
  useLabOwnedPorts: () => ({
    solverPortRef: testState.solverPortRef,
    benchmarkPortRef: testState.benchmarkPortRef,
  }),
}));

vi.mock('../labKeyboard', () => ({
  subscribeLabKeyboardControls: () => () => undefined,
}));

const mountedRoots: Root[] = [];
const EDITED_LEVEL_INPUT = ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'].join('\n');

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

function HookHarness({ initialPlayable }: { initialPlayable?: PlayableEntry }) {
  testState.latest = useLabOrchestration(initialPlayable);
  return null;
}

async function renderHarness(initialPlayable?: PlayableEntry) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<HookHarness initialPlayable={initialPlayable} />);
  });

  return { root };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useLabOrchestration publishing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    testState.latest = null;
    testState.navigate.mockReset();
    testState.upsertSessionPlayableEntry.mockReset();
    testState.solverPortRef.current = null;
    testState.benchmarkPortRef.current = null;
    testState.upsertSessionPlayableEntry.mockImplementation(
      ({ ref, originRef, collectionRef, collectionIndex, level }) => ({
        ref: ref ?? 'temp:lab-session-1',
        source:
          originRef || collectionRef || typeof collectionIndex === 'number'
            ? {
                kind: 'session' as const,
                ...(originRef ? { originRef } : {}),
                ...(collectionRef ? { collectionRef } : {}),
                ...(typeof collectionIndex === 'number' ? { collectionIndex } : {}),
              }
            : { kind: 'session' as const },
        level,
      }),
    );
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

  it('does not publish session entries on mount or after parse-only commits', async () => {
    await renderHarness();

    expect(testState.upsertSessionPlayableEntry).not.toHaveBeenCalled();

    await act(async () => {
      testState.latest?.setInput(EDITED_LEVEL_INPUT);
    });
    await act(async () => {
      testState.latest?.applyParse();
    });
    await flushPromises();

    expect(testState.upsertSessionPlayableEntry).not.toHaveBeenCalled();
  });

  it('short-circuits noop guard callbacks when the next action would not change state', async () => {
    await renderHarness();

    const initialFormat = testState.latest?.format;
    const initialInput = testState.latest?.input;
    const initialParseState = testState.latest?.parseState;

    await act(async () => {
      if (initialFormat) {
        testState.latest?.setFormat(initialFormat);
      }
      testState.latest?.cancelSolve();
      testState.latest?.applySolution();
      testState.latest?.runSolve();
      testState.latest?.runBench();
    });

    expect(testState.latest?.format).toBe(initialFormat);
    expect(testState.latest?.input).toBe(initialInput);
    expect(testState.latest?.parseState).toEqual(initialParseState);
    expect(testState.latest?.solveState).toEqual({ status: 'idle' });
    expect(testState.latest?.benchState).toEqual({ status: 'idle' });
  });

  it('publishes only on explicit handoff actions and reuses the same session ref after edits', async () => {
    const builtinPlayable: PlayableEntry = {
      ref: 'builtin:lab-builtin',
      source: { kind: 'builtin' },
      level: {
        id: 'lab-builtin',
        name: 'Builtin Lab Level',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
      },
    };

    await renderHarness(builtinPlayable);

    await act(async () => {
      testState.latest?.openInPlay();
    });

    expect(testState.upsertSessionPlayableEntry).toHaveBeenCalledTimes(1);
    expect(testState.upsertSessionPlayableEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: undefined,
        originRef: 'builtin:lab-builtin',
        level: expect.objectContaining({
          ...builtinPlayable.level,
          knownSolution: null,
        }),
      }),
    );
    expect(testState.navigate).toHaveBeenCalledWith(
      buildPlayHref({
        levelRef: 'temp:lab-session-1',
        levelId: 'lab-builtin',
        exactLevelKey: createPlayableExactLevelKey({
          ...builtinPlayable.level,
          knownSolution: null,
        }),
      }),
    );

    await act(async () => {
      testState.latest?.setInput(EDITED_LEVEL_INPUT);
    });
    await act(async () => {
      testState.latest?.applyParse();
    });
    await flushPromises();

    expect(testState.upsertSessionPlayableEntry).toHaveBeenCalledTimes(1);

    await act(async () => {
      testState.latest?.sendToBench();
    });

    expect(testState.upsertSessionPlayableEntry).toHaveBeenCalledTimes(2);
    expect(testState.upsertSessionPlayableEntry).toHaveBeenLastCalledWith({
      ref: 'temp:lab-session-1',
      originRef: 'builtin:lab-builtin',
      collectionRef: undefined,
      collectionIndex: undefined,
      level: {
        id: 'lab-level',
        name: 'Lab Level',
        rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
        knownSolution: null,
      },
    });
    expect(testState.navigate).toHaveBeenLastCalledWith(
      buildBenchHref({
        levelRef: 'temp:lab-session-1',
        levelId: 'lab-level',
        exactLevelKey: createPlayableExactLevelKey({
          id: 'lab-level',
          name: 'Lab Level',
          rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
          knownSolution: null,
        }),
      }),
    );
  });

  it('ignores stale solve progress and stale solve failures after a parse commits a new revision', async () => {
    const deferredSolve = createDeferred<never>();
    let progressHandler:
      | ((progress: { expanded: number; generated: number; elapsedMs: number }) => void)
      | undefined;
    const cancelSolve = vi.fn();

    testState.solverPortRef.current = {
      startSolve: vi.fn(
        (options: {
          onProgress?: (progress: {
            expanded: number;
            generated: number;
            elapsedMs: number;
          }) => void;
        }) => {
          progressHandler = options.onProgress;
          options.onProgress?.({
            expanded: 3,
            generated: 5,
            elapsedMs: 1.5,
          });
          return deferredSolve.promise;
        },
      ),
      cancelSolve,
    };

    await renderHarness();

    await act(async () => {
      testState.latest?.runSolve();
    });

    const runningRunId =
      testState.latest?.solveState.status === 'running' ? testState.latest.solveState.runId : null;
    expect(runningRunId).toBeTruthy();

    await act(async () => {
      testState.latest?.setInput(EDITED_LEVEL_INPUT);
      testState.latest?.applyParse();
    });

    expect(cancelSolve).toHaveBeenCalledWith(runningRunId);
    expect(testState.latest?.solveState).toEqual({ status: 'idle' });

    await act(async () => {
      progressHandler?.({
        expanded: 99,
        generated: 101,
        elapsedMs: 8,
      });
    });
    expect(testState.latest?.solveState).toEqual({ status: 'idle' });

    deferredSolve.reject(new Error('stale solve failure'));
    await flushPromises();

    expect(testState.latest?.solveState).toEqual({ status: 'idle' });
  });

  it('uses the preview level entry when benchmarking and ignores stale benchmark failures after a parse commit', async () => {
    const deferredBench = createDeferred<never>();
    const cancelSuite = vi.fn();

    testState.benchmarkPortRef.current = {
      runSuite: vi.fn(
        (options: {
          suiteRunId: string;
          levelResolver: () => unknown;
          levelEntryResolver: () => {
            ref: string;
            source: { kind: 'session' };
            level: { id: string; name: string; rows: string[]; knownSolution?: string | null };
          };
        }) => {
          expect(options.levelResolver()).toBeTruthy();
          expect(options.levelEntryResolver()).toEqual({
            ref: 'lab:preview',
            source: { kind: 'session' },
            level: expect.objectContaining({
              id: 'lab-level',
              name: 'Lab Level',
            }),
          });
          return deferredBench.promise;
        },
      ),
      cancelSuite,
    };

    await renderHarness();

    await act(async () => {
      testState.latest?.runBench();
    });

    const suiteRunId = (
      testState.benchmarkPortRef.current as {
        runSuite: ReturnType<typeof vi.fn>;
      }
    ).runSuite.mock.calls[0]?.[0]?.suiteRunId as string | undefined;
    expect(suiteRunId).toBeTruthy();
    expect(testState.latest?.benchState).toEqual({ status: 'running' });

    await act(async () => {
      testState.latest?.setInput(EDITED_LEVEL_INPUT);
      testState.latest?.applyParse();
    });

    expect(cancelSuite).toHaveBeenCalledWith(suiteRunId);
    expect(testState.latest?.benchState).toEqual({ status: 'idle' });

    deferredBench.reject(new Error('stale bench failure'));
    await flushPromises();

    expect(testState.latest?.benchState).toEqual({ status: 'idle' });
  });

  it('preserves imported pack collection metadata when republishing an edited session entry', async () => {
    const packedPlayable: PlayableEntry = {
      ref: 'temp:packed-entry-2',
      source: {
        kind: 'session',
        originRef: 'builtin:lab-pack-base',
        collectionRef: 'collection:bench-pack-1',
        collectionIndex: 1,
      },
      level: {
        id: 'lab-pack-base',
        name: 'Packed Lab Level',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
      },
    };

    await renderHarness(packedPlayable);

    await act(async () => {
      testState.latest?.setInput(EDITED_LEVEL_INPUT);
    });
    await act(async () => {
      testState.latest?.applyParse();
    });
    await flushPromises();

    await act(async () => {
      testState.latest?.openInPlay();
    });

    expect(testState.upsertSessionPlayableEntry).toHaveBeenCalledWith({
      ref: 'temp:packed-entry-2',
      originRef: 'builtin:lab-pack-base',
      collectionRef: 'collection:bench-pack-1',
      collectionIndex: 1,
      level: {
        id: 'lab-level',
        name: 'Lab Level',
        rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
        knownSolution: null,
      },
    });
    expect(testState.navigate).toHaveBeenLastCalledWith(
      buildPlayHref({
        levelRef: 'temp:packed-entry-2',
        levelId: 'lab-level',
        exactLevelKey: createPlayableExactLevelKey({
          id: 'lab-level',
          name: 'Lab Level',
          rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
          knownSolution: null,
        }),
      }),
    );
  });
});
