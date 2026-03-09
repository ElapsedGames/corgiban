import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { builtinLevels } from '@corgiban/levels';

import { createAppStore } from '../../state/store';
import { move, nextLevel } from '../../state/gameSlice';
import { setWorkerHealth, solveRunCompleted, solveRunStarted } from '../../state/solverSlice';

const testState = vi.hoisted(() => ({
  solverPanelProps: null as null | Record<string, unknown>,
  sidePanelProps: null as null | Record<string, unknown>,
  bottomControlsProps: null as null | Record<string, unknown>,
  gameCanvasProps: null as null | Record<string, unknown>,
}));

vi.mock('../../canvas/GameCanvas', () => ({
  GameCanvas: (props: Record<string, unknown>) => {
    testState.gameCanvasProps = props;
    return <div data-testid="game-canvas-stub" />;
  },
}));

vi.mock('../SidePanel', () => ({
  SidePanel: (props: Record<string, unknown>) => {
    testState.sidePanelProps = props;
    return <div data-testid="side-panel-stub" />;
  },
}));

vi.mock('../BottomControls', () => ({
  BottomControls: (props: Record<string, unknown>) => {
    testState.bottomControlsProps = props;
    return <div data-testid="bottom-controls-stub" />;
  },
}));

vi.mock('../SolverPanel', () => ({
  SolverPanel: (props: Record<string, unknown>) => {
    testState.solverPanelProps = props;
    return <div data-testid="solver-panel-stub" />;
  },
}));

import { PlayPage } from '../PlayPage';

function renderPage(store = createAppStore()) {
  const html = renderToStaticMarkup(
    <Provider store={store}>
      <PlayPage />
    </Provider>,
  );
  return { store, html };
}

describe('PlayPage', () => {
  beforeEach(() => {
    testState.solverPanelProps = null;
    testState.sidePanelProps = null;
    testState.bottomControlsProps = null;
    testState.gameCanvasProps = null;
  });

  it('renders the play shell and forwards solver selection changes to Redux state', () => {
    const { store, html } = renderPage();

    expect(html).toContain('Corgiban');
    expect(html).toContain('board-heading');
    expect(html).toContain('play-shell');
    expect(testState.solverPanelProps).not.toBeNull();
    expect(testState.sidePanelProps?.canGoToPreviousLevel).toBe(false);
    expect(testState.gameCanvasProps?.cellSize).toBe(56);

    const onSelectAlgorithm = testState.solverPanelProps?.onSelectAlgorithm as
      | ((algorithmId: string) => void)
      | undefined;
    expect(onSelectAlgorithm).toBeTypeOf('function');

    onSelectAlgorithm?.('bfsPush');
    expect(store.getState().solver.selectedAlgorithmId).toBe('bfsPush');
  });

  it('forwards replay speed changes to settingsSlice', () => {
    const { store } = renderPage();

    const onReplaySpeedChange = testState.solverPanelProps?.onReplaySpeedChange as
      | ((speed: number) => void)
      | undefined;
    expect(onReplaySpeedChange).toBeTypeOf('function');

    onReplaySpeedChange?.(1.5);
    expect(store.getState().settings.solverReplaySpeed).toBe(1.5);
  });

  it('sets failed solver state when run is requested with the noop solver port', async () => {
    const { store } = renderPage();

    const onRun = testState.solverPanelProps?.onRun as (() => void) | undefined;
    expect(onRun).toBeTypeOf('function');

    onRun?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(store.getState().solver.status).toBe('failed');
    expect(store.getState().solver.error).toContain('unavailable');
  });

  it('falls back to the default level metadata when the active level id is unknown', () => {
    const store = createAppStore();
    store.dispatch(nextLevel({ levelId: 'missing-level' }));
    store.dispatch(move({ direction: 'L', changed: true, pushed: false }));

    renderPage(store);

    expect(testState.sidePanelProps).not.toBeNull();
    expect(testState.sidePanelProps?.levelId).toBe('classic-001');
  });

  it('uses fallback level metadata to compute next-level transitions from unknown ids', () => {
    const store = createAppStore();
    store.dispatch(nextLevel({ levelId: 'missing-level' }));
    renderPage(store);

    const onNextLevel = testState.sidePanelProps?.onNextLevel as (() => void) | undefined;
    expect(onNextLevel).toBeTypeOf('function');

    onNextLevel?.();

    expect(store.getState().game.levelId).toBe(builtinLevels[1]?.id ?? builtinLevels[0]?.id);
  });

  it('wires side-panel and sequence callbacks into game state updates', () => {
    const store = createAppStore();
    store.dispatch(move({ direction: 'L', changed: true, pushed: false }));

    renderPage(store);

    const onUndo = testState.sidePanelProps?.onUndo as (() => void) | undefined;
    const onRestart = testState.sidePanelProps?.onRestart as (() => void) | undefined;
    const onApplySequence = testState.bottomControlsProps?.onApplySequence as
      | ((directions: string[]) => { applied: number; stoppedAt: number | null })
      | undefined;

    expect(onUndo).toBeTypeOf('function');
    expect(onRestart).toBeTypeOf('function');
    expect(onApplySequence).toBeTypeOf('function');

    onUndo?.();
    expect(store.getState().game.stats.moves).toBe(0);

    const noOpResult = onApplySequence?.([]);
    expect(noOpResult).toEqual({ applied: 0, stoppedAt: null });
    expect(store.getState().game.stats.moves).toBe(0);

    const applied = onApplySequence?.(['L']);
    expect(applied?.applied).toBeGreaterThanOrEqual(1);
    expect(store.getState().game.stats.moves).toBeGreaterThanOrEqual(1);

    onRestart?.();
    expect(store.getState().game.stats.moves).toBe(0);
    expect(store.getState().game.stats.pushes).toBe(0);
  });

  it('no-ops undo and apply-solution when there is no history or solution', () => {
    const store = createAppStore();
    renderPage(store);

    const onUndo = testState.sidePanelProps?.onUndo as (() => void) | undefined;
    const onApply = testState.solverPanelProps?.onApply as (() => void) | undefined;
    expect(onUndo).toBeTypeOf('function');
    expect(onApply).toBeTypeOf('function');

    const beforeMoves = store.getState().game.stats.moves;
    onUndo?.();
    onApply?.();

    expect(store.getState().game.stats.moves).toBe(beforeMoves);
  });

  it('applies parsed solution moves from the initial level state and ignores non-UDLR characters', () => {
    const store = createAppStore();
    renderPage(store);

    const onApplySequence = testState.bottomControlsProps?.onApplySequence as
      | ((directions: string[]) => { applied: number; stoppedAt: number | null })
      | undefined;
    expect(onApplySequence).toBeTypeOf('function');

    const firstApply = onApplySequence?.(['R']);
    expect(firstApply?.applied).toBe(1);
    expect(store.getState().game.stats.moves).toBe(1);

    store.dispatch(solveRunStarted({ runId: 'solve-1', algorithmId: 'bfsPush' }));
    store.dispatch(
      solveRunCompleted({
        runId: 'solve-1',
        algorithmId: 'bfsPush',
        status: 'solved',
        solutionMoves: 'RX',
        metrics: {
          elapsedMs: 1,
          expanded: 1,
          generated: 1,
          maxDepth: 1,
          maxFrontier: 1,
          pushCount: 0,
          moveCount: 1,
        },
      }),
    );

    renderPage(store);

    const onApply = testState.solverPanelProps?.onApply as (() => void) | undefined;
    expect(onApply).toBeTypeOf('function');

    onApply?.();

    expect(store.getState().game.stats.moves).toBe(1);
  });

  it('dispatches cancelSolve when solver cancel is requested from the panel', () => {
    const store = createAppStore();
    store.dispatch(solveRunStarted({ runId: 'run-cancel-me', algorithmId: 'bfsPush' }));
    renderPage(store);

    const onCancel = testState.solverPanelProps?.onCancel as (() => void) | undefined;
    expect(onCancel).toBeTypeOf('function');

    onCancel?.();

    expect(store.getState().solver.status).toBe('cancelling');
    expect(store.getState().solver.activeRunId).toBe('run-cancel-me');
  });

  it('retries worker health from the panel callback', () => {
    const store = createAppStore();
    store.dispatch(setWorkerHealth('crashed'));
    expect(store.getState().solver.workerHealth).toBe('crashed');
    renderPage(store);

    const onRetryWorker = testState.solverPanelProps?.onRetryWorker as (() => void) | undefined;
    expect(onRetryWorker).toBeTypeOf('function');

    onRetryWorker?.();

    expect(store.getState().solver.status).toBe('idle');
    expect(store.getState().solver.workerHealth).toBe('idle');
    expect(store.getState().solver.error).toBeNull();
  });

  it('advances to the next level and resets game stats from side-panel callback', () => {
    const store = createAppStore();
    const initialLevelId = store.getState().game.levelId;
    store.dispatch(move({ direction: 'L', changed: true, pushed: false }));
    renderPage(store);

    const onNextLevel = testState.sidePanelProps?.onNextLevel as (() => void) | undefined;
    expect(onNextLevel).toBeTypeOf('function');
    onNextLevel?.();

    const expectedNextLevelId =
      builtinLevels.length > 1
        ? (builtinLevels[1]?.id ?? initialLevelId)
        : (builtinLevels[0]?.id ?? initialLevelId);

    expect(store.getState().game.levelId).toBe(expectedNextLevelId);
    expect(store.getState().game.stats.moves).toBe(0);
    expect(store.getState().game.stats.pushes).toBe(0);
  });

  it('enables previous-level navigation after leaving the first level and returns to it', () => {
    const store = createAppStore();
    const firstLevelId = store.getState().game.levelId;
    const secondLevelId = builtinLevels[1]?.id;

    if (!secondLevelId) {
      renderPage(store);
      expect(testState.sidePanelProps?.canGoToPreviousLevel).toBe(false);
      return;
    }

    store.dispatch(nextLevel({ levelId: secondLevelId }));
    store.dispatch(move({ direction: 'L', changed: true, pushed: false }));
    renderPage(store);

    expect(testState.sidePanelProps?.canGoToPreviousLevel).toBe(true);

    const onPreviousLevel = testState.sidePanelProps?.onPreviousLevel as (() => void) | undefined;
    expect(onPreviousLevel).toBeTypeOf('function');

    onPreviousLevel?.();

    expect(store.getState().game.levelId).toBe(firstLevelId);
    expect(store.getState().game.stats.moves).toBe(0);
    expect(store.getState().game.stats.pushes).toBe(0);
  });

  it('keeps replay callbacks as no-ops when no replay controller is attached', () => {
    const store = createAppStore();
    renderPage(store);

    const onReplayPlayPause = testState.solverPanelProps?.onReplayPlayPause as
      | (() => void)
      | undefined;
    const onReplayStepBack = testState.solverPanelProps?.onReplayStepBack as
      | (() => void)
      | undefined;
    const onReplayStepForward = testState.solverPanelProps?.onReplayStepForward as
      | (() => void)
      | undefined;

    expect(onReplayPlayPause).toBeTypeOf('function');
    expect(onReplayStepBack).toBeTypeOf('function');
    expect(onReplayStepForward).toBeTypeOf('function');

    expect(() => onReplayPlayPause?.()).not.toThrow();
    expect(() => onReplayStepBack?.()).not.toThrow();
    expect(() => onReplayStepForward?.()).not.toThrow();
    expect(store.getState().solver.replayState).toBe('idle');
    expect(store.getState().solver.replayIndex).toBe(0);
  });

  it.todo(
    'moves focus to the "Next Level" button in the solved banner when the puzzle is solved (requires JSDOM and @testing-library/react to exercise useEffect)',
  );
});
