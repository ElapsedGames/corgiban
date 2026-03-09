// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const effectState = vi.hoisted(() => ({
  controllerInstances: [] as Array<{
    loadSolution: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stepBack: ReturnType<typeof vi.fn>;
    stepForward: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }>,
  solverPanelProps: null as null | Record<string, unknown>,
}));

const testLevels = vi.hoisted(() => ({
  tinyLevel: {
    id: 'test-level-1',
    name: 'Test Level',
    rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
  },
}));

vi.mock('@corgiban/levels', () => ({
  builtinLevels: [testLevels.tinyLevel],
  builtinLevelsByCategory: {
    test: [testLevels.tinyLevel],
  },
}));

vi.mock('../../canvas/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="game-canvas-stub" />,
}));

vi.mock('../SidePanel', () => ({
  SidePanel: () => <div data-testid="side-panel-stub" />,
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

    constructor() {
      effectState.controllerInstances.push(this);
    }
  },
}));

import { move } from '../../state/gameSlice';
import { createAppStore } from '../../state/store';
import { setReplayState, solveRunCompleted, solveRunStarted } from '../../state/solverSlice';
import { PlayPage } from '../PlayPage';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (element) => element.textContent?.trim() === label,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button "${label}" not found.`);
  }

  return button;
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

describe('PlayPage effects', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    effectState.controllerInstances.length = 0;
    effectState.solverPanelProps = null;
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

  it('moves focus to the solved-banner next-level button when the puzzle becomes solved', async () => {
    const { container, root, store } = await renderPage();

    await act(async () => {
      store.dispatch(move({ direction: 'R', changed: true, pushed: true }));
    });

    await flushEffects();

    const nextLevelButton = findButton(container, 'Next Level');
    expect(container.textContent).toContain('Puzzle solved!');
    expect(document.activeElement).toBe(nextLevelButton);

    await act(async () => {
      root.unmount();
    });
  });

  it('scrolls the board into view when solution animation starts on small screens', async () => {
    const originalInnerWidth = window.innerWidth;
    const { container, root, store } = await renderPage();

    await act(async () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 1023,
      });
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
    const scrollIntoView = vi.fn();
    Object.defineProperty(boardSection as HTMLElement, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    onAnimate?.();

    expect(effectState.controllerInstances).toHaveLength(1);
    expect(effectState.controllerInstances[0]?.loadSolution).toHaveBeenCalledWith(['R'], true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });

    await act(async () => {
      root.unmount();
    });
  });
});
