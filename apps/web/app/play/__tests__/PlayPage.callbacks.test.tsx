// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMove, createGame, parseLevel } from '@corgiban/core';
import { builtinLevels } from '@corgiban/levels';

const callbackState = vi.hoisted(() => ({
  solverPanelProps: null as null | Record<string, unknown>,
  keyboardHandlers: null as null | {
    onMove: (direction: 'U' | 'D' | 'L' | 'R') => void;
    onUndo: () => void;
    onRestart: () => void;
    onNextLevel: () => void;
    enabled?: boolean;
  },
  controllerInstances: [] as Array<{
    stop: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    stepBack: ReturnType<typeof vi.fn>;
    stepForward: ReturnType<typeof vi.fn>;
    loadSolution: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('../../replay/replayController.client', () => ({
  ReplayController: class {
    stop = vi.fn();
    start = vi.fn();
    pause = vi.fn();
    stepBack = vi.fn();
    stepForward = vi.fn();
    loadSolution = vi.fn();

    constructor() {
      callbackState.controllerInstances.push(this);
    }
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
    callbackState.solverPanelProps = props;
    return <div data-testid="solver-panel-stub" />;
  },
}));

vi.mock('../useKeyboardControls', () => ({
  useKeyboardControls: (handlers: {
    onMove: (direction: 'U' | 'D' | 'L' | 'R') => void;
    onUndo: () => void;
    onRestart: () => void;
    onNextLevel: () => void;
    enabled?: boolean;
  }) => {
    callbackState.keyboardHandlers = handlers;
  },
}));

import { createAppStore } from '../../state/store';
import { move, nextLevel } from '../../state/gameSlice';
import { solveRunCompleted, solveRunStarted } from '../../state/solverSlice';
import { PlayPage } from '../PlayPage';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];

const keyboardFixtureLevel = builtinLevels.find((level) => {
  const game = createGame(parseLevel(level));
  const rightMove = applyMove(game, 'R');
  const downMove = applyMove(game, 'D');
  if (!rightMove.changed || downMove.changed) {
    return false;
  }
  return applyMove(rightMove.state, 'L').changed;
});

async function renderPage(store = createAppStore()) {
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

  return { root, store };
}

describe('PlayPage callback behavior', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    callbackState.solverPanelProps = null;
    callbackState.keyboardHandlers = null;
    callbackState.controllerInstances.length = 0;
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
  });

  it('applies a valid keyboard move and increments move stats', async () => {
    const store = createAppStore();
    expect(keyboardFixtureLevel).toBeTruthy();
    store.dispatch(
      nextLevel({ levelId: keyboardFixtureLevel?.id ?? store.getState().game.levelId }),
    );
    await renderPage(store);

    await act(async () => {
      callbackState.keyboardHandlers?.onMove('R');
    });

    expect(store.getState().game.stats.moves).toBe(1);
    expect(callbackState.controllerInstances[0]?.stop).toHaveBeenCalledTimes(1);
  });

  it('ignores blocked keyboard moves while still stopping replay', async () => {
    const store = createAppStore();
    expect(keyboardFixtureLevel).toBeTruthy();
    store.dispatch(
      nextLevel({ levelId: keyboardFixtureLevel?.id ?? store.getState().game.levelId }),
    );
    await renderPage(store);

    await act(async () => {
      callbackState.keyboardHandlers?.onMove('D');
    });

    expect(store.getState().game.stats.moves).toBe(0);
    expect(callbackState.controllerInstances[0]?.stop).toHaveBeenCalledTimes(1);
  });

  it('undoes the latest move through keyboard controls', async () => {
    const store = createAppStore();
    store.dispatch(move({ direction: 'R', changed: true, pushed: false }));
    await renderPage(store);
    expect(store.getState().game.stats.moves).toBe(1);

    await act(async () => {
      callbackState.keyboardHandlers?.onUndo();
    });

    expect(store.getState().game.stats.moves).toBe(0);
    expect(callbackState.controllerInstances[0]?.stop).toHaveBeenCalledTimes(1);
  });

  it('restarts level state through keyboard controls', async () => {
    const store = createAppStore();
    expect(keyboardFixtureLevel).toBeTruthy();
    store.dispatch(
      nextLevel({ levelId: keyboardFixtureLevel?.id ?? store.getState().game.levelId }),
    );
    await renderPage(store);

    await act(async () => {
      callbackState.keyboardHandlers?.onMove('R');
      callbackState.keyboardHandlers?.onMove('L');
    });
    expect(store.getState().game.stats.moves).toBe(2);

    await act(async () => {
      callbackState.keyboardHandlers?.onRestart();
    });

    expect(store.getState().game.stats.moves).toBe(0);
    expect(store.getState().game.stats.pushes).toBe(0);
  });

  it('advances to the next level through keyboard controls', async () => {
    const { store } = await renderPage();
    const initialLevelId = store.getState().game.levelId;

    await act(async () => {
      callbackState.keyboardHandlers?.onNextLevel();
    });

    const expectedNextLevelId =
      builtinLevels.length > 1
        ? (builtinLevels[1]?.id ?? initialLevelId)
        : (builtinLevels[0]?.id ?? initialLevelId);
    expect(store.getState().game.levelId).toBe(expectedNextLevelId);
  });

  it('animates parsed solution moves and ignores non-UDLR characters', async () => {
    const store = createAppStore();
    await renderPage(store);

    await act(async () => {
      store.dispatch(solveRunStarted({ runId: 'solve-animate', algorithmId: 'bfsPush' }));
      store.dispatch(
        solveRunCompleted({
          runId: 'solve-animate',
          algorithmId: 'bfsPush',
          status: 'solved',
          solutionMoves: 'RX',
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

    const onAnimate = callbackState.solverPanelProps?.onAnimate as (() => void) | undefined;
    expect(onAnimate).toBeTypeOf('function');

    await act(async () => {
      onAnimate?.();
    });

    const controller = callbackState.controllerInstances.at(-1);
    expect(controller?.loadSolution).toHaveBeenCalledTimes(1);
    expect(controller?.loadSolution).toHaveBeenCalledWith(['R'], true);
  });

  it('does not animate when there is no solved move sequence', async () => {
    await renderPage();

    const onAnimate = callbackState.solverPanelProps?.onAnimate as (() => void) | undefined;
    expect(onAnimate).toBeTypeOf('function');

    await act(async () => {
      onAnimate?.();
    });

    const controller = callbackState.controllerInstances.at(-1);
    expect(controller?.loadSolution).not.toHaveBeenCalled();
  });
});
