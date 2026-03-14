// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMove, createGame, parseLevel } from '@corgiban/core';
import { analyzeLevel, chooseAlgorithm } from '@corgiban/solver';

import {
  clearSessionPlayableEntries,
  upsertSessionPlayableEntry,
} from '../../levels/temporaryLevelCatalog';
import { createPlayableExactLevelKey } from '../../levels/playableIdentity';
import { PLAY_PROGRESS_STORAGE_KEY } from '../usePlayProgress';

const effectState = vi.hoisted(() => ({
  controllerInstances: [] as Array<{
    loadSolution: ReturnType<typeof vi.fn>;
    loadMovesFromState: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stepBack: ReturnType<typeof vi.fn>;
    stepForward: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }>,
  controllerOptions: [] as Array<Record<string, unknown>>,
  gameCanvasProps: null as null | Record<string, unknown>,
  sidePanelProps: null as null | Record<string, unknown>,
  solverPanelProps: null as null | Record<string, unknown>,
}));

const testLevels = vi.hoisted(() => ({
  tinyLevel: {
    id: 'test-level-1',
    name: 'Test Level',
    rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
  },
  secondLevel: {
    id: 'test-level-2',
    name: 'Second Test Level',
    rows: ['WWWWW', 'WPEEW', 'WETBW', 'WWWWW'],
  },
}));

vi.mock('@corgiban/levels', async (importOriginal: () => Promise<unknown>) => {
  const actual = (await importOriginal()) as typeof import('@corgiban/levels');
  return {
    ...actual,
    builtinLevels: [testLevels.tinyLevel, testLevels.secondLevel],
    builtinLevelsByCategory: {
      test: [testLevels.tinyLevel, testLevels.secondLevel],
    },
  };
});

vi.mock('../../canvas/GameCanvas', () => ({
  GameCanvas: (props: Record<string, unknown>) => {
    effectState.gameCanvasProps = props;
    const state = props.state as { playerIndex: number };
    return <div data-testid="game-canvas-stub" data-player-index={String(state.playerIndex)} />;
  },
}));

vi.mock('../SidePanel', () => ({
  SidePanel: (props: Record<string, unknown>) => {
    effectState.sidePanelProps = props;
    return <div data-testid="side-panel-stub" />;
  },
}));

vi.mock('../BottomControls', () => ({
  BottomControls: () => <div data-testid="bottom-controls-stub" />,
}));

vi.mock('../SolverPanel', () => ({
  SolverPanel: (props: Record<string, unknown>) => {
    effectState.solverPanelProps = props;
    return <div data-testid="solver-panel-stub" />;
  },
}));

vi.mock('../../levels/RequestedEntryUnavailable', () => ({
  RequestedEntryUnavailablePage: () => <div data-testid="requested-entry-unavailable" />,
}));

vi.mock('../useKeyboardControls', () => ({
  useKeyboardControls: () => undefined,
}));

vi.mock('../../replay/replayController.client', () => ({
  ReplayController: class {
    loadSolution = vi.fn();
    loadMovesFromState = vi.fn();
    pause = vi.fn();
    start = vi.fn();
    stepBack = vi.fn();
    stepForward = vi.fn();
    stop = vi.fn();

    constructor(options: Record<string, unknown>) {
      effectState.controllerInstances.push(this);
      effectState.controllerOptions.push(options);
    }
  },
}));

import { move, nextLevel } from '../../state/gameSlice';
import { createAppStore } from '../../state/store';
import {
  setReplayState,
  solveRunCompleted,
  solveRunFailed,
  solveRunStarted,
} from '../../state/solverSlice';
import { PlayPage } from '../PlayPage';
import { getMaxWidthMediaQuery } from '../../ui/responsive';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];
const mobileBoardAutoScrollQuery = getMaxWidthMediaQuery('lg');

function createRect({ top, height }: { top: number; height: number }): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    bottom: top + height,
    left: 0,
    right: 0,
    width: 0,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

async function renderPage(props: Parameters<typeof PlayPage>[0] = {}, store = createAppStore()) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  const renderWithProps = async (nextProps: Parameters<typeof PlayPage>[0] = props) => {
    await act(async () => {
      root.render(
        <Provider store={store}>
          <PlayPage {...nextProps} />
        </Provider>,
      );
    });
  };

  await renderWithProps(props);

  return { container, root, store, rerender: renderWithProps };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function mockMatchMedia(matchingQueries: string[] = []) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: matchingQueries.includes(query),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  });
}

function getCanvasPlayerIndex(container: HTMLElement) {
  const canvas = container.querySelector('[data-testid="game-canvas-stub"]');
  expect(canvas).toBeInstanceOf(HTMLElement);
  return canvas?.getAttribute('data-player-index');
}

describe('PlayPage effects', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    window.history.replaceState({}, '', '/play');
    effectState.controllerInstances.length = 0;
    effectState.controllerOptions.length = 0;
    effectState.gameCanvasProps = null;
    effectState.sidePanelProps = null;
    effectState.solverPanelProps = null;
    clearSessionPlayableEntries();
    mockMatchMedia();
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
    clearSessionPlayableEntries();
  });

  it('restarts from the base level, reapplies the solver solution, and clears replay state when replay finishes', async () => {
    const { root, store } = await renderPage();

    await act(async () => {
      store.dispatch(move({ direction: 'L', changed: true, pushed: false }));
    });

    expect(store.getState().game.history).toEqual([{ direction: 'L', pushed: false }]);

    await act(async () => {
      store.dispatch(solveRunStarted({ runId: 'solve-replay-finished', algorithmId: 'bfsPush' }));
      store.dispatch(
        solveRunCompleted({
          runId: 'solve-replay-finished',
          algorithmId: 'bfsPush',
          status: 'solved',
          solutionMoves: 'R',
          metrics: {
            elapsedMs: 1,
            expanded: 1,
            generated: 1,
            maxDepth: 1,
            maxFrontier: 1,
            pushCount: 1,
            moveCount: 1,
          },
        }),
      );
      store.dispatch(setReplayState('done'));
    });

    await flushEffects();

    expect(store.getState().game.history).toEqual([{ direction: 'R', pushed: true }]);
    expect(store.getState().game.stats).toEqual({ moves: 1, pushes: 1 });
    expect(store.getState().solver.replayState).toBe('idle');
    expect(store.getState().solver.replayIndex).toBe(0);
    expect(store.getState().solver.replayTotalSteps).toBe(0);

    await act(async () => {
      root.unmount();
    });
  });

  it('shows the solved banner without rendering a duplicate next-level action', async () => {
    const { container, root, store } = await renderPage();

    await act(async () => {
      store.dispatch(move({ direction: 'R', changed: true, pushed: true }));
    });

    await flushEffects();

    expect(container.textContent).toContain('Puzzle solved!');
    expect(container.textContent).toContain('Copy Move List');
    expect(container.textContent).not.toContain('Next Level');
    expect(container.querySelectorAll('button')).toHaveLength(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('hides the mobile copy-move-list action again after advancing to the next level', async () => {
    const { container, root, store } = await renderPage();

    expect(container.textContent).not.toContain('Copy Move List');

    await act(async () => {
      store.dispatch(move({ direction: 'R', changed: true, pushed: true }));
    });

    await flushEffects();

    expect(container.textContent).toContain('Copy Move List');

    const onNextLevel = effectState.sidePanelProps?.onNextLevel as (() => void) | undefined;
    expect(onNextLevel).toBeTypeOf('function');

    await act(async () => {
      onNextLevel?.();
    });

    await flushEffects();

    expect(store.getState().game.levelId).toBe(testLevels.secondLevel.id);
    expect(container.textContent).not.toContain('Copy Move List');

    await act(async () => {
      root.unmount();
    });
  });

  it('does not recreate the replay controller for unrelated solver-state rerenders', async () => {
    const { root, store } = await renderPage();

    expect(effectState.controllerInstances).toHaveLength(1);

    await act(async () => {
      store.dispatch(setReplayState('playing'));
    });

    await flushEffects();

    expect(effectState.controllerInstances).toHaveLength(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('jumps the board section below the sticky header before solution animation starts on narrow viewports', async () => {
    mockMatchMedia([mobileBoardAutoScrollQuery]);
    const stickyHeader = document.createElement('header');
    stickyHeader.className = 'app-nav';
    document.body.appendChild(stickyHeader);
    Object.defineProperty(stickyHeader, 'getBoundingClientRect', {
      configurable: true,
      value: () => createRect({ top: 0, height: 72 }),
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 320,
    });

    const { container, root, store } = await renderPage();

    await act(async () => {
      store.dispatch(solveRunStarted({ runId: 'solve-animate-scroll', algorithmId: 'bfsPush' }));
      store.dispatch(
        solveRunCompleted({
          runId: 'solve-animate-scroll',
          algorithmId: 'bfsPush',
          status: 'solved',
          solutionMoves: 'R',
          metrics: {
            elapsedMs: 1,
            expanded: 1,
            generated: 1,
            maxDepth: 1,
            maxFrontier: 1,
            pushCount: 1,
            moveCount: 1,
          },
        }),
      );
    });

    const onAnimate = effectState.solverPanelProps?.onAnimate as (() => void) | undefined;
    expect(onAnimate).toBeTypeOf('function');

    const boardSection = container.querySelector('#game-board');
    expect(boardSection).toBeInstanceOf(HTMLElement);
    Object.defineProperty(boardSection as HTMLElement, 'getBoundingClientRect', {
      configurable: true,
      value: () => createRect({ top: 240, height: 180 }),
    });
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    });

    onAnimate?.();

    expect(effectState.controllerInstances).toHaveLength(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 488, behavior: 'auto' });
    expect(effectState.controllerInstances[0]?.loadMovesFromState).toHaveBeenCalledWith(
      expect.any(Object),
      ['R'],
      true,
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('does not auto-scroll the board before solution animation starts on desktop viewports', async () => {
    const { root, store } = await renderPage();

    await act(async () => {
      store.dispatch(
        solveRunStarted({ runId: 'solve-animate-scroll-desktop', algorithmId: 'bfsPush' }),
      );
      store.dispatch(
        solveRunCompleted({
          runId: 'solve-animate-scroll-desktop',
          algorithmId: 'bfsPush',
          status: 'solved',
          solutionMoves: 'R',
          metrics: {
            elapsedMs: 1,
            expanded: 1,
            generated: 1,
            maxDepth: 1,
            maxFrontier: 1,
            pushCount: 1,
            moveCount: 1,
          },
        }),
      );
    });

    const onAnimate = effectState.solverPanelProps?.onAnimate as (() => void) | undefined;
    expect(onAnimate).toBeTypeOf('function');

    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    });

    onAnimate?.();

    expect(effectState.controllerInstances).toHaveLength(1);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(effectState.controllerInstances[0]?.loadMovesFromState).toHaveBeenCalledWith(
      expect.any(Object),
      ['R'],
      true,
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('does not reapply or clear replay state when replay finishes without valid solution moves', async () => {
    const { root, store } = await renderPage();

    await act(async () => {
      store.dispatch(move({ direction: 'L', changed: true, pushed: false }));
      store.dispatch(solveRunStarted({ runId: 'solve-empty-finish', algorithmId: 'bfsPush' }));
      store.dispatch(
        solveRunCompleted({
          runId: 'solve-empty-finish',
          algorithmId: 'bfsPush',
          status: 'solved',
          solutionMoves: 'XYZ',
          metrics: {
            elapsedMs: 1,
            expanded: 1,
            generated: 1,
            maxDepth: 1,
            maxFrontier: 1,
            pushCount: 0,
            moveCount: 0,
          },
        }),
      );
      store.dispatch(setReplayState('done'));
    });

    await flushEffects();

    expect(store.getState().game.history).toEqual([{ direction: 'L', pushed: false }]);
    expect(store.getState().solver.replayState).toBe('done');

    await act(async () => {
      root.unmount();
    });
  });

  it('locks the mobile solver run action after failure until the level changes', async () => {
    const { root, store } = await renderPage();

    expect(effectState.solverPanelProps?.mobileRunLocked).toBe(false);

    await act(async () => {
      store.dispatch(solveRunStarted({ runId: 'solve-failed-lock', algorithmId: 'bfsPush' }));
      store.dispatch(
        solveRunFailed({
          runId: 'solve-failed-lock',
          message: 'Solver unavailable for this level.',
        }),
      );
    });

    await flushEffects();

    expect(effectState.solverPanelProps?.mobileRunLocked).toBe(true);

    const onNextLevel = effectState.sidePanelProps?.onNextLevel as (() => void) | undefined;
    expect(onNextLevel).toBeTypeOf('function');

    await act(async () => {
      onNextLevel?.();
    });

    await flushEffects();

    expect(store.getState().game.levelId).toBe(testLevels.secondLevel.id);
    expect(effectState.solverPanelProps?.mobileRunLocked).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('locks the mobile solver run action after a timeout result until the level changes', async () => {
    const { root, store } = await renderPage();

    expect(effectState.solverPanelProps?.mobileRunLocked).toBe(false);

    await act(async () => {
      store.dispatch(solveRunStarted({ runId: 'solve-timeout-lock', algorithmId: 'bfsPush' }));
      store.dispatch(
        solveRunCompleted({
          runId: 'solve-timeout-lock',
          algorithmId: 'bfsPush',
          status: 'timeout',
          metrics: {
            elapsedMs: 5000,
            expanded: 100,
            generated: 120,
            maxDepth: 7,
            maxFrontier: 16,
            pushCount: 0,
            moveCount: 0,
          },
        }),
      );
    });

    await flushEffects();

    expect(effectState.solverPanelProps?.mobileRunLocked).toBe(true);

    const onNextLevel = effectState.sidePanelProps?.onNextLevel as (() => void) | undefined;
    expect(onNextLevel).toBeTypeOf('function');

    await act(async () => {
      onNextLevel?.();
    });

    await flushEffects();

    expect(store.getState().game.levelId).toBe(testLevels.secondLevel.id);
    expect(effectState.solverPanelProps?.mobileRunLocked).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('does not lock the mobile solver run action after a manual cancel result', async () => {
    const { root, store } = await renderPage();

    await act(async () => {
      store.dispatch(solveRunStarted({ runId: 'solve-cancel-no-lock', algorithmId: 'bfsPush' }));
      store.dispatch(
        solveRunCompleted({
          runId: 'solve-cancel-no-lock',
          algorithmId: 'bfsPush',
          status: 'cancelled',
          metrics: {
            elapsedMs: 250,
            expanded: 5,
            generated: 7,
            maxDepth: 2,
            maxFrontier: 3,
            pushCount: 0,
            moveCount: 0,
          },
        }),
      );
    });

    await flushEffects();

    expect(effectState.solverPanelProps?.mobileRunLocked).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders replay shadow state and clears it after restart stops replay', async () => {
    const { container, root } = await renderPage();
    const initialPlayerIndex = createGame(parseLevel(testLevels.tinyLevel)).playerIndex;
    const replayState = applyMove(createGame(parseLevel(testLevels.tinyLevel)), 'R').state;
    const onStateChange = effectState.controllerOptions[0]?.onStateChange as
      | ((state: ReturnType<typeof createGame>) => void)
      | undefined;
    const onRestart = effectState.sidePanelProps?.onRestart as (() => void) | undefined;

    expect(onStateChange).toBeTypeOf('function');
    expect(onRestart).toBeTypeOf('function');
    expect(getCanvasPlayerIndex(container)).toBe(String(initialPlayerIndex));

    await act(async () => {
      onStateChange?.(replayState);
    });

    expect(getCanvasPlayerIndex(container)).toBe(String(replayState.playerIndex));

    await act(async () => {
      onRestart?.();
    });

    expect(effectState.controllerInstances[0]?.stop).toHaveBeenCalledTimes(1);
    expect(getCanvasPlayerIndex(container)).toBe(String(initialPlayerIndex));

    await act(async () => {
      root.unmount();
    });
  });

  it('applies a requested playable level id after mount', async () => {
    const { root, store } = await renderPage({ requestedLevelId: testLevels.secondLevel.id });

    await flushEffects();

    expect(store.getState().game.levelId).toBe(testLevels.secondLevel.id);
    expect(effectState.sidePanelProps?.levelId).toBe(testLevels.secondLevel.id);

    await act(async () => {
      root.unmount();
    });
  });

  it('restores the last played level from browser-local progress when no handoff level is requested', async () => {
    window.localStorage.setItem(
      PLAY_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        lastPlayedLevel: {
          levelRef: `builtin:${testLevels.secondLevel.id}`,
          levelId: testLevels.secondLevel.id,
        },
        completedLevelIds: [],
        updatedAtIso: '2026-03-13T00:00:00.000Z',
      }),
    );

    const { root, store } = await renderPage();

    await flushEffects();
    await flushEffects();

    expect(store.getState().game.levelId).toBe(testLevels.secondLevel.id);
    expect(effectState.sidePanelProps?.levelId).toBe(testLevels.secondLevel.id);

    await act(async () => {
      root.unmount();
    });
  });

  it('skips browser-local restoration when the saved level is no longer playable', async () => {
    window.localStorage.setItem(
      PLAY_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        lastPlayedLevel: {
          levelRef: 'builtin:missing-level',
          levelId: 'missing-level',
        },
        completedLevelIds: [],
        updatedAtIso: '2026-03-13T00:00:00.000Z',
      }),
    );

    const { root, store } = await renderPage();

    await flushEffects();

    expect(store.getState().game.levelId).toBe(testLevels.tinyLevel.id);
    expect(effectState.sidePanelProps?.levelId).toBe(testLevels.tinyLevel.id);

    await act(async () => {
      root.unmount();
    });
  });

  it('skips browser-local restoration when the saved last-played entry is session-scoped', async () => {
    const sessionEntry = upsertSessionPlayableEntry({
      level: {
        id: 'restored-session-level',
        name: 'Restored Session Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    });
    window.localStorage.setItem(
      PLAY_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        lastPlayedLevel: {
          levelRef: sessionEntry.ref,
          levelId: sessionEntry.level.id,
        },
        completedLevelIds: [],
        updatedAtIso: '2026-03-13T00:00:00.000Z',
      }),
    );

    const { root, store } = await renderPage();

    await flushEffects();

    expect(store.getState().game.levelId).toBe(testLevels.tinyLevel.id);
    expect(effectState.sidePanelProps?.levelId).toBe(testLevels.tinyLevel.id);

    await act(async () => {
      root.unmount();
    });
  });

  it('preserves canonical built-in play query params after applying a requested level and algorithm', async () => {
    window.history.replaceState({}, '', '/play?levelId=test-level-2&algorithmId=astarPush');
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    const { root } = await renderPage({
      requestedLevelId: testLevels.secondLevel.id,
      requestedAlgorithmId: 'astarPush',
    });

    await flushEffects();

    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?levelId=test-level-2&algorithmId=astarPush');

    replaceStateSpy.mockRestore();
    await act(async () => {
      root.unmount();
    });
  });

  it('preserves unrelated query params when canonicalizing a built-in exact handoff', async () => {
    const builtinExactLevelKey = createPlayableExactLevelKey(testLevels.secondLevel);
    window.history.replaceState(
      {},
      '',
      `/play?source=bench&levelRef=builtin:${testLevels.secondLevel.id}&levelId=${testLevels.secondLevel.id}&exactLevelKey=${encodeURIComponent(builtinExactLevelKey)}&algorithmId=astarPush`,
    );
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    const { root } = await renderPage({
      requestedLevelRef: `builtin:${testLevels.secondLevel.id}`,
      requestedLevelId: testLevels.secondLevel.id,
      requestedExactLevelKey: builtinExactLevelKey,
      requestedAlgorithmId: 'astarPush',
    });

    await flushEffects();

    expect(replaceStateSpy).toHaveBeenCalledWith(
      window.history.state,
      '',
      `/play?source=bench&levelId=${testLevels.secondLevel.id}&algorithmId=astarPush`,
    );

    replaceStateSpy.mockRestore();
    await act(async () => {
      root.unmount();
    });
  });

  it('keeps canonical built-in level query params when the requested level already matches the active playable entry', async () => {
    window.history.replaceState({}, '', `/play?levelId=${testLevels.tinyLevel.id}`);
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    const { root, store } = await renderPage({
      requestedLevelId: testLevels.tinyLevel.id,
    });

    await flushEffects();

    expect(store.getState().game.levelId).toBe(testLevels.tinyLevel.id);
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(window.location.search).toBe(`?levelId=${testLevels.tinyLevel.id}`);

    replaceStateSpy.mockRestore();
    await act(async () => {
      root.unmount();
    });
  });

  it('canonicalizes built-in exact handoff query params back to a levelId plus algorithm link', async () => {
    const builtinExactLevelKey = createPlayableExactLevelKey(testLevels.secondLevel);
    window.history.replaceState(
      {},
      '',
      `/play?levelRef=builtin:${testLevels.secondLevel.id}&levelId=${testLevels.secondLevel.id}&exactLevelKey=${encodeURIComponent(builtinExactLevelKey)}&algorithmId=astarPush`,
    );
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    const { root } = await renderPage({
      requestedLevelRef: `builtin:${testLevels.secondLevel.id}`,
      requestedLevelId: testLevels.secondLevel.id,
      requestedExactLevelKey: builtinExactLevelKey,
      requestedAlgorithmId: 'astarPush',
    });

    await flushEffects();

    expect(replaceStateSpy).toHaveBeenCalledWith(
      window.history.state,
      '',
      `/play?levelId=${testLevels.secondLevel.id}&algorithmId=astarPush`,
    );

    replaceStateSpy.mockRestore();
    await act(async () => {
      root.unmount();
    });
  });

  it('clears exact session handoff query params after activation', async () => {
    const sessionEntry = upsertSessionPlayableEntry({
      level: {
        id: 'session-cleanup-level',
        name: 'Session Cleanup Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    });
    const sessionExactLevelKey = createPlayableExactLevelKey(sessionEntry.level);
    window.history.replaceState(
      {},
      '',
      `/play?levelRef=${encodeURIComponent(sessionEntry.ref)}&levelId=${sessionEntry.level.id}&exactLevelKey=${encodeURIComponent(sessionExactLevelKey)}&algorithmId=astarPush`,
    );
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    const { root, store } = await renderPage({
      requestedLevelRef: sessionEntry.ref,
      requestedLevelId: sessionEntry.level.id,
      requestedExactLevelKey: sessionExactLevelKey,
      requestedAlgorithmId: 'astarPush',
    });

    await flushEffects();

    expect(store.getState().game.activeLevelRef).toBe(sessionEntry.ref);
    expect(replaceStateSpy).toHaveBeenCalledWith(window.history.state, '', '/play');

    replaceStateSpy.mockRestore();
    await act(async () => {
      root.unmount();
    });
  });

  it('preserves unrelated query params when clearing an exact session handoff', async () => {
    const sessionEntry = upsertSessionPlayableEntry({
      level: {
        id: 'session-cleanup-level-2',
        name: 'Session Cleanup Level 2',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    });
    const sessionExactLevelKey = createPlayableExactLevelKey(sessionEntry.level);
    window.history.replaceState(
      {},
      '',
      `/play?view=compact&levelRef=${encodeURIComponent(sessionEntry.ref)}&levelId=${sessionEntry.level.id}&exactLevelKey=${encodeURIComponent(sessionExactLevelKey)}&algorithmId=astarPush`,
    );
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    const { root } = await renderPage({
      requestedLevelRef: sessionEntry.ref,
      requestedLevelId: sessionEntry.level.id,
      requestedExactLevelKey: sessionExactLevelKey,
      requestedAlgorithmId: 'astarPush',
    });

    await flushEffects();

    expect(replaceStateSpy).toHaveBeenCalledWith(window.history.state, '', '/play?view=compact');

    replaceStateSpy.mockRestore();
    await act(async () => {
      root.unmount();
    });
  });

  it('persists the active level and completed built-in level ids to browser-local progress', async () => {
    const { root, store } = await renderPage();

    await flushEffects();

    let persistedProgress = JSON.parse(
      window.localStorage.getItem(PLAY_PROGRESS_STORAGE_KEY) ?? '{}',
    );
    expect(persistedProgress.lastPlayedLevel.levelId).toBe(testLevels.tinyLevel.id);
    expect(persistedProgress.completedLevelIds).toEqual([]);

    await act(async () => {
      store.dispatch(move({ direction: 'R', changed: true, pushed: true }));
    });

    await flushEffects();

    persistedProgress = JSON.parse(window.localStorage.getItem(PLAY_PROGRESS_STORAGE_KEY) ?? '{}');
    expect(persistedProgress.lastPlayedLevel.levelId).toBe(testLevels.tinyLevel.id);
    expect(persistedProgress.completedLevelIds).toContain(testLevels.tinyLevel.id);

    await act(async () => {
      root.unmount();
    });
  });

  it('does not overwrite saved built-in progress when a session/custom handoff level is opened', async () => {
    window.localStorage.setItem(
      PLAY_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        lastPlayedLevel: {
          levelRef: `builtin:${testLevels.secondLevel.id}`,
          levelId: testLevels.secondLevel.id,
        },
        completedLevelIds: [testLevels.secondLevel.id],
        updatedAtIso: '2026-03-13T00:00:00.000Z',
      }),
    );
    const sessionEntry = upsertSessionPlayableEntry({
      level: {
        id: 'custom-session-level',
        name: 'Custom Session Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    });

    const { root, store } = await renderPage({
      requestedLevelRef: sessionEntry.ref,
      requestedLevelId: sessionEntry.level.id,
    });

    await flushEffects();

    expect(store.getState().game.activeLevelRef).toBe(sessionEntry.ref);
    expect(JSON.parse(window.localStorage.getItem(PLAY_PROGRESS_STORAGE_KEY) ?? '{}')).toEqual({
      version: 2,
      lastPlayedLevel: {
        levelRef: `builtin:${testLevels.secondLevel.id}`,
        levelId: testLevels.secondLevel.id,
      },
      completedLevelIds: [testLevels.secondLevel.id],
      updatedAtIso: '2026-03-13T00:00:00.000Z',
    });

    await act(async () => {
      root.unmount();
    });
  });

  it('falls back to the saved built-in level after refreshing without handoff params', async () => {
    window.localStorage.setItem(
      PLAY_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        lastPlayedLevel: {
          levelRef: `builtin:${testLevels.secondLevel.id}`,
          levelId: testLevels.secondLevel.id,
        },
        completedLevelIds: [],
        updatedAtIso: '2026-03-13T00:00:00.000Z',
      }),
    );
    const sessionEntry = upsertSessionPlayableEntry({
      level: {
        id: 'custom-session-level',
        name: 'Custom Session Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    });

    const firstRender = await renderPage({
      requestedLevelRef: sessionEntry.ref,
      requestedLevelId: sessionEntry.level.id,
    });
    await flushEffects();
    expect(firstRender.store.getState().game.activeLevelRef).toBe(sessionEntry.ref);

    await act(async () => {
      firstRender.root.unmount();
    });

    const refreshedRender = await renderPage();
    await flushEffects();

    expect(refreshedRender.store.getState().game.levelId).toBe(testLevels.secondLevel.id);

    await act(async () => {
      refreshedRender.root.unmount();
    });
  });

  it('applies a requested level id only once so user navigation can diverge from the handoff param', async () => {
    const { root, store } = await renderPage({ requestedLevelId: testLevels.secondLevel.id });

    await flushEffects();

    const onPreviousLevel = effectState.sidePanelProps?.onPreviousLevel as (() => void) | undefined;
    expect(onPreviousLevel).toBeTypeOf('function');

    await act(async () => {
      onPreviousLevel?.();
    });

    await flushEffects();

    expect(store.getState().game.levelId).toBe(testLevels.tinyLevel.id);
    expect(effectState.sidePanelProps?.levelId).toBe(testLevels.tinyLevel.id);

    await act(async () => {
      root.unmount();
    });
  });

  it('ignores requested level ids that are not playable', async () => {
    const { root, store } = await renderPage({ requestedLevelId: 'missing-level' });

    await flushEffects();

    expect(store.getState().game.levelId).toBe(testLevels.tinyLevel.id);
    expect(effectState.sidePanelProps?.levelId).toBe(testLevels.tinyLevel.id);

    await act(async () => {
      root.unmount();
    });
  });

  it('reapplies a new requested level id when navigation updates the handoff param', async () => {
    const { root, store, rerender } = await renderPage({
      requestedLevelId: testLevels.secondLevel.id,
    });

    await flushEffects();
    expect(store.getState().game.levelId).toBe(testLevels.secondLevel.id);

    await rerender({ requestedLevelId: testLevels.tinyLevel.id });
    await flushEffects();

    expect(store.getState().game.levelId).toBe(testLevels.tinyLevel.id);
    expect(effectState.sidePanelProps?.levelId).toBe(testLevels.tinyLevel.id);

    await act(async () => {
      root.unmount();
    });
  });

  it('atomically applies a requested session level ref and algorithm id after mount', async () => {
    const sessionEntry = upsertSessionPlayableEntry({
      originRef: `builtin:${testLevels.tinyLevel.id}`,
      level: {
        ...testLevels.tinyLevel,
        name: 'Edited Test Level',
        rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
      },
    });

    const { root, store } = await renderPage({
      requestedLevelRef: sessionEntry.ref,
      requestedAlgorithmId: 'astarPush',
    });

    await flushEffects();

    expect(store.getState().game.activeLevelRef).toBe(sessionEntry.ref);
    expect(store.getState().game.levelId).toBe(testLevels.tinyLevel.id);
    expect(effectState.sidePanelProps?.levelId).toBe(testLevels.tinyLevel.id);
    expect(effectState.sidePanelProps?.levelName).toBe('Edited Test Level');
    expect(store.getState().solver.selectedAlgorithmId).toBe('astarPush');

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps the requested algorithm when legacy levelId handoff recomputes a different recommendation', async () => {
    const requestedAlgorithmId = 'astarPush';
    const expectedRecommendation = chooseAlgorithm(
      analyzeLevel(parseLevel(testLevels.secondLevel)),
    );
    expect(expectedRecommendation).not.toBe(requestedAlgorithmId);

    const { root, store } = await renderPage({
      requestedLevelId: testLevels.secondLevel.id,
      requestedAlgorithmId,
    });

    await flushEffects();

    expect(store.getState().game.levelId).toBe(testLevels.secondLevel.id);
    expect(store.getState().solver.recommendation?.algorithmId).toBe(expectedRecommendation);
    expect(store.getState().solver.selectedAlgorithmId).toBe(requestedAlgorithmId);
    expect(effectState.solverPanelProps?.selectedAlgorithmId).toBe(requestedAlgorithmId);

    await act(async () => {
      root.unmount();
    });
  });

  it('applies a requested supported algorithm id after mount', async () => {
    const { root, store } = await renderPage({ requestedAlgorithmId: 'astarPush' });

    await flushEffects();

    expect(store.getState().solver.selectedAlgorithmId).toBe('astarPush');
    expect(effectState.solverPanelProps?.selectedAlgorithmId).toBe('astarPush');

    await act(async () => {
      root.unmount();
    });
  });

  it('applies a requested algorithm id only once so user selection can diverge from the handoff param', async () => {
    const { root, store } = await renderPage({ requestedAlgorithmId: 'astarPush' });

    await flushEffects();

    const onSelectAlgorithm = effectState.solverPanelProps?.onSelectAlgorithm as
      | ((algorithmId: string) => void)
      | undefined;
    expect(onSelectAlgorithm).toBeTypeOf('function');

    await act(async () => {
      onSelectAlgorithm?.('bfsPush');
    });

    await flushEffects();

    expect(store.getState().solver.selectedAlgorithmId).toBe('bfsPush');
    expect(effectState.solverPanelProps?.selectedAlgorithmId).toBe('bfsPush');

    await act(async () => {
      root.unmount();
    });
  });

  it('clears the applied route signature when handoff params are removed so the same handoff can apply again later', async () => {
    const { root, store, rerender } = await renderPage({ requestedAlgorithmId: 'astarPush' });

    await flushEffects();
    expect(store.getState().solver.selectedAlgorithmId).toBe('astarPush');

    await rerender({});
    await flushEffects();

    const onSelectAlgorithm = effectState.solverPanelProps?.onSelectAlgorithm as
      | ((algorithmId: string) => void)
      | undefined;
    expect(onSelectAlgorithm).toBeTypeOf('function');

    await act(async () => {
      onSelectAlgorithm?.('bfsPush');
    });
    expect(store.getState().solver.selectedAlgorithmId).toBe('bfsPush');

    await rerender({ requestedAlgorithmId: 'astarPush' });
    await flushEffects();

    expect(store.getState().solver.selectedAlgorithmId).toBe('astarPush');

    await act(async () => {
      root.unmount();
    });
  });

  it('applies a combined route handoff only once so user changes survive same-param rerenders', async () => {
    const { root, store, rerender } = await renderPage({
      requestedLevelId: testLevels.secondLevel.id,
      requestedAlgorithmId: 'astarPush',
    });

    await flushEffects();

    const onSelectAlgorithm = effectState.solverPanelProps?.onSelectAlgorithm as
      | ((algorithmId: string) => void)
      | undefined;
    expect(onSelectAlgorithm).toBeTypeOf('function');

    await act(async () => {
      onSelectAlgorithm?.('bfsPush');
    });

    await rerender({
      requestedLevelId: testLevels.secondLevel.id,
      requestedAlgorithmId: 'astarPush',
    });
    await flushEffects();

    expect(store.getState().game.levelId).toBe(testLevels.secondLevel.id);
    expect(store.getState().solver.selectedAlgorithmId).toBe('bfsPush');

    await act(async () => {
      root.unmount();
    });
  });

  it('reapplies a new requested algorithm id when navigation updates the handoff param', async () => {
    const { root, store, rerender } = await renderPage({ requestedAlgorithmId: 'astarPush' });

    await flushEffects();
    expect(store.getState().solver.selectedAlgorithmId).toBe('astarPush');

    await rerender({ requestedAlgorithmId: 'bfsPush' });
    await flushEffects();

    expect(store.getState().solver.selectedAlgorithmId).toBe('bfsPush');
    expect(effectState.solverPanelProps?.selectedAlgorithmId).toBe('bfsPush');

    await act(async () => {
      root.unmount();
    });
  });

  it('updates the algorithm when only the algorithm handoff param changes for the same level', async () => {
    const { root, store, rerender } = await renderPage({
      requestedLevelId: testLevels.secondLevel.id,
      requestedAlgorithmId: 'astarPush',
    });

    await flushEffects();
    const activeLevelRef = store.getState().game.activeLevelRef;

    await rerender({
      requestedLevelId: testLevels.secondLevel.id,
      requestedAlgorithmId: 'bfsPush',
    });
    await flushEffects();

    expect(store.getState().game.activeLevelRef).toBe(activeLevelRef);
    expect(store.getState().game.levelId).toBe(testLevels.secondLevel.id);
    expect(store.getState().solver.selectedAlgorithmId).toBe('bfsPush');

    await act(async () => {
      root.unmount();
    });
  });

  it('defaults Play to Greedy Push when no algorithm handoff is provided', async () => {
    const { root, store } = await renderPage();

    await flushEffects();

    expect(store.getState().solver.selectedAlgorithmId).toBe('greedyPush');
    expect(effectState.solverPanelProps?.selectedAlgorithmId).toBe('greedyPush');

    await act(async () => {
      root.unmount();
    });
  });

  it('defaults to Greedy Push when a requested algorithm id is not supported', async () => {
    const { root, store } = await renderPage({
      requestedAlgorithmId: 'unknown' as never,
    });

    await flushEffects();

    expect(store.getState().solver.selectedAlgorithmId).toBe('greedyPush');
    expect(effectState.solverPanelProps?.selectedAlgorithmId).toBe('greedyPush');

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps the recommendation but defaults selection to Greedy Push when a requested algorithm is invalid during level activation', async () => {
    const expectedRecommendation = chooseAlgorithm(
      analyzeLevel(parseLevel(testLevels.secondLevel)),
    );
    const { root, store } = await renderPage({
      requestedLevelId: testLevels.secondLevel.id,
      requestedAlgorithmId: 'unknown' as never,
    });

    await flushEffects();

    expect(store.getState().game.levelId).toBe(testLevels.secondLevel.id);
    expect(store.getState().solver.recommendation?.algorithmId).toBe(expectedRecommendation);
    expect(store.getState().solver.selectedAlgorithmId).toBe('greedyPush');

    await act(async () => {
      root.unmount();
    });
  });

  it('clears replay state without creating a controller when the active level becomes unavailable', async () => {
    const store = createAppStore();
    store.dispatch(setReplayState('playing'));
    store.dispatch(move({ direction: 'L', changed: true, pushed: false }));
    store.dispatch(nextLevel({ levelId: 'missing-level' }));

    const { root } = await renderPage({}, store);

    await flushEffects();

    expect(effectState.controllerInstances).toHaveLength(0);
    expect(store.getState().solver.replayState).toBe('idle');

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps unavailable active levels closed when only an algorithm handoff param is present', async () => {
    const store = createAppStore();
    store.dispatch(nextLevel({ levelId: 'missing-level' }));

    const { root } = await renderPage(
      {
        requestedAlgorithmId: 'astarPush',
      },
      store,
    );

    await flushEffects();

    expect(effectState.controllerInstances).toHaveLength(0);
    expect(store.getState().game.levelId).toBe('missing-level');
    expect(store.getState().solver.selectedAlgorithmId).not.toBe('astarPush');

    await act(async () => {
      root.unmount();
    });
  });
});
