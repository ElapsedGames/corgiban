import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';

import { createAppStore } from '../../state/store';
import { move, nextLevel } from '../../state/gameSlice';
import { solveRunCompleted, solveRunStarted } from '../../state/solverSlice';

const testState = vi.hoisted(() => ({
  solverPanelProps: null as null | Record<string, unknown>,
  sidePanelProps: null as null | Record<string, unknown>,
  bottomControlsProps: null as null | Record<string, unknown>,
}));

vi.mock('../../canvas/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="game-canvas-stub" />,
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
  });

  it('renders the play shell and forwards solver selection changes to Redux state', () => {
    const { store, html } = renderPage();

    expect(html).toContain('Corgiban');
    expect(html).toContain('Current level');
    expect(testState.solverPanelProps).not.toBeNull();

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
});
