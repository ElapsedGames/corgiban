import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
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
  refCallCount: 0,
  controller: null as null | {
    stop: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    stepBack: ReturnType<typeof vi.fn>;
    stepForward: ReturnType<typeof vi.fn>;
    loadSolution: ReturnType<typeof vi.fn>;
  },
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useRef: <T,>(initial: T) => {
      const ref = actual.useRef(initial);
      callbackState.refCallCount += 1;
      const refSlot = ((callbackState.refCallCount - 1) % 3) + 1;
      if (refSlot === 2 && callbackState.controller) {
        (ref as { current: unknown }).current = callbackState.controller;
      }
      return ref;
    },
  };
});

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
import { move } from '../../state/gameSlice';
import { solveRunCompleted, solveRunStarted } from '../../state/solverSlice';
import { PlayPage } from '../PlayPage';

function renderPage(store = createAppStore()) {
  callbackState.refCallCount = 0;
  renderToStaticMarkup(
    <Provider store={store}>
      <PlayPage />
    </Provider>,
  );
  return store;
}

describe('PlayPage callback behavior', () => {
  beforeEach(() => {
    callbackState.solverPanelProps = null;
    callbackState.keyboardHandlers = null;
    callbackState.refCallCount = 0;
    callbackState.controller = {
      stop: vi.fn(),
      start: vi.fn(),
      pause: vi.fn(),
      stepBack: vi.fn(),
      stepForward: vi.fn(),
      loadSolution: vi.fn(),
    };
  });

  it('applies a valid keyboard move and increments move stats', () => {
    const store = renderPage();
    callbackState.keyboardHandlers?.onMove('R');

    expect(store.getState().game.stats.moves).toBe(1);
    expect(callbackState.controller?.stop).toHaveBeenCalledTimes(1);
  });

  it('ignores blocked keyboard moves while still stopping replay', () => {
    const store = renderPage();
    callbackState.keyboardHandlers?.onMove('D');

    expect(store.getState().game.stats.moves).toBe(0);
    expect(callbackState.controller?.stop).toHaveBeenCalledTimes(1);
  });

  it('undoes the latest move through keyboard controls', () => {
    const store = createAppStore();
    store.dispatch(move({ direction: 'R', changed: true, pushed: false }));
    renderPage(store);
    expect(store.getState().game.stats.moves).toBe(1);

    callbackState.keyboardHandlers?.onUndo();
    expect(store.getState().game.stats.moves).toBe(0);
    expect(callbackState.controller?.stop).toHaveBeenCalledTimes(1);
  });

  it('restarts level state through keyboard controls', () => {
    const store = renderPage();
    callbackState.keyboardHandlers?.onMove('R');
    callbackState.keyboardHandlers?.onMove('L');
    expect(store.getState().game.stats.moves).toBe(2);

    callbackState.keyboardHandlers?.onRestart();
    expect(store.getState().game.stats.moves).toBe(0);
    expect(store.getState().game.stats.pushes).toBe(0);
  });

  it('advances to the next level through keyboard controls', () => {
    const store = renderPage();
    const initialLevelId = store.getState().game.levelId;

    callbackState.keyboardHandlers?.onNextLevel();

    const expectedNextLevelId =
      builtinLevels.length > 1
        ? (builtinLevels[1]?.id ?? initialLevelId)
        : (builtinLevels[0]?.id ?? initialLevelId);
    expect(store.getState().game.levelId).toBe(expectedNextLevelId);
  });

  it('animates parsed solution moves and ignores non-UDLR characters', () => {
    const store = createAppStore();
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
    renderPage(store);

    const onAnimate = callbackState.solverPanelProps?.onAnimate as (() => void) | undefined;
    expect(onAnimate).toBeTypeOf('function');

    onAnimate?.();

    expect(callbackState.controller?.loadSolution).toHaveBeenCalledTimes(1);
    expect(callbackState.controller?.loadSolution).toHaveBeenCalledWith(['R'], true);
  });

  it('does not animate when there is no solved move sequence', () => {
    renderPage();

    const onAnimate = callbackState.solverPanelProps?.onAnimate as (() => void) | undefined;
    expect(onAnimate).toBeTypeOf('function');

    onAnimate?.();

    expect(callbackState.controller?.loadSolution).not.toHaveBeenCalled();
  });
});
