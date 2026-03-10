// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMove, createGame, parseLevel } from '@corgiban/core';

const effectState = vi.hoisted(() => ({
  controllerInstances: [] as Array<{
    loadSolution: ReturnType<typeof vi.fn>;
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

vi.mock('@corgiban/levels', () => ({
  builtinLevels: [testLevels.tinyLevel, testLevels.secondLevel],
  builtinLevelsByCategory: {
    test: [testLevels.tinyLevel, testLevels.secondLevel],
  },
}));

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

vi.mock('../useKeyboardControls', () => ({
  useKeyboardControls: () => undefined,
}));

vi.mock('../../replay/replayController.client', () => ({
  ReplayController: class {
    loadSolution = vi.fn();
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

import { move } from '../../state/gameSlice';
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

async function renderPage() {
  const store = createAppStore();
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(
      <Provider store={store}>
        <PlayPage />
      </Provider>,
    );
  });

  return { container, root, store };
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
    effectState.controllerInstances.length = 0;
    effectState.controllerOptions.length = 0;
    effectState.gameCanvasProps = null;
    effectState.sidePanelProps = null;
    effectState.solverPanelProps = null;
    mockMatchMedia();
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
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
    expect(container.querySelectorAll('button')).toHaveLength(0);

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
    expect(effectState.controllerInstances[0]?.loadSolution).toHaveBeenCalledWith(['R'], true);

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
    expect(effectState.controllerInstances[0]?.loadSolution).toHaveBeenCalledWith(['R'], true);

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
});
