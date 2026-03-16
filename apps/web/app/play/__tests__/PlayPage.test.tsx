import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { builtinLevels } from '@corgiban/levels';
import { parseLevel } from '@corgiban/core';

import { BoardSkinPreferenceProvider } from '../../canvas/useAppBoardSkin';
import {
  clearSessionPlayableEntries,
  createPlayableLevelFingerprint,
  toBuiltinLevelRef,
  upsertSessionPlayableCollection,
  upsertSessionPlayableEntry,
} from '../../levels/temporaryLevelCatalog';
import { createPlayableExactLevelKey } from '../../levels/playableIdentity';
import { handleLevelChange } from '../../state';
import { createAppStore } from '../../state/store';
import { move, nextLevel } from '../../state/gameSlice';
import { setWorkerHealth, solveRunCompleted, solveRunStarted } from '../../state/solverSlice';

const testState = vi.hoisted(() => ({
  solverPanelProps: null as null | Record<string, unknown>,
  sidePanelProps: null as null | Record<string, unknown>,
  bottomControlsProps: null as null | Record<string, unknown>,
  gameCanvasProps: null as null | Record<string, unknown>,
  unavailableProps: null as null | Record<string, unknown>,
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

vi.mock('../../levels/RequestedEntryPending', () => ({
  RequestedEntryPendingPage: (props: Record<string, unknown>) => (
    <div data-testid="requested-entry-pending">{String(props.heading ?? '')}</div>
  ),
}));

vi.mock('../../levels/RequestedEntryUnavailable', () => ({
  RequestedEntryUnavailablePage: (props: Record<string, unknown>) => {
    testState.unavailableProps = props;
    return <div data-testid="requested-entry-unavailable">{String(props.heading ?? '')}</div>;
  },
}));

vi.mock('../../levels/usePlayableLevels', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../levels/usePlayableLevels')>();
  const catalog = await import('../../levels/temporaryLevelCatalog');
  const { resolveRequestedPlayableEntryFromEntries } =
    await import('../../levels/requestedPlayableEntry');
  return {
    ...actual,
    usePlayableCatalogSnapshot: () => ({
      entries: catalog.listPlayableEntries(),
      completeness: 'client-session-aware' as const,
    }),
    usePlayableLevels: () => catalog.listPlayableEntries(),
    useResolvedPlayableEntry: (request: { levelRef?: string | null; levelId?: string | null }) => {
      const entries = catalog.listPlayableEntries();
      const resolution = resolveRequestedPlayableEntryFromEntries(entries, request);
      return resolution.status === 'resolved' ? resolution.entry : null;
    },
  };
});

import { PlayPage } from '../PlayPage';

function renderPage(store = createAppStore(), props: Parameters<typeof PlayPage>[0] = {}) {
  const html = renderToStaticMarkup(
    <Provider store={store}>
      <PlayPage {...props} />
    </Provider>,
  );
  return { store, html };
}

function renderPageWithSkin(
  boardSkinId: 'classic' | 'legacy',
  store = createAppStore(),
  props: Parameters<typeof PlayPage>[0] = {},
) {
  const html = renderToStaticMarkup(
    <Provider store={store}>
      <BoardSkinPreferenceProvider boardSkinId={boardSkinId}>
        <PlayPage {...props} />
      </BoardSkinPreferenceProvider>
    </Provider>,
  );
  return { store, html };
}

describe('PlayPage', () => {
  afterEach(() => {
    clearSessionPlayableEntries();
  });

  beforeEach(() => {
    testState.solverPanelProps = null;
    testState.sidePanelProps = null;
    testState.bottomControlsProps = null;
    testState.gameCanvasProps = null;
    testState.unavailableProps = null;
  });

  it('renders the play shell and forwards solver selection changes to Redux state', () => {
    const { store, html } = renderPage();

    expect(html).toContain('Corgiban');
    expect(html).toContain('board-heading');
    expect(html).toContain('play-shell');
    expect(html).toContain('Level 1');
    expect(html).toContain('-mx-7 border-y border-border bg-panel px-4 py-4 shadow-none');
    expect(html).toContain(
      '<div class="hidden lg:block"><div data-testid="bottom-controls-stub"></div></div>',
    );
    expect(testState.solverPanelProps).not.toBeNull();
    expect(testState.solverPanelProps?.mobileRunLocked).toBe(false);
    expect(testState.sidePanelProps?.showLevelNavigation).toBe(true);
    expect(testState.sidePanelProps?.canGoToPreviousLevel).toBe(false);
    expect(testState.gameCanvasProps?.cellSize).toBe(56);
    expect(testState.gameCanvasProps?.skinId).toBe('classic');

    const onSelectAlgorithm = testState.solverPanelProps?.onSelectAlgorithm as
      | ((algorithmId: string) => void)
      | undefined;
    expect(onSelectAlgorithm).toBeTypeOf('function');

    onSelectAlgorithm?.('bfsPush');
    expect(store.getState().solver.selectedAlgorithmId).toBe('bfsPush');
  });

  it('renders the mobile copy-move-list action only when the current puzzle is solved', () => {
    const idleRender = renderPage();
    expect(idleRender.html).not.toContain('Copy Move List');

    const sessionEntry = upsertSessionPlayableEntry({
      level: {
        id: 'mobile-copy-list-level',
        name: 'Mobile Copy List Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    });
    const solvedStore = createAppStore();
    solvedStore.dispatch(
      handleLevelChange(parseLevel(sessionEntry.level), {
        levelRef: sessionEntry.ref,
        levelId: sessionEntry.level.id,
        exactLevelKey: createPlayableExactLevelKey(sessionEntry.level),
      }),
    );
    solvedStore.dispatch(
      move({
        direction: 'R',
        changed: true,
        pushed: true,
      }),
    );
    const solvedRender = renderPage(solvedStore);

    expect(solvedRender.html).toContain('Copy Move List');
    expect(solvedRender.html).not.toContain('Move History');
    expect(solvedRender.html).not.toContain('1 total');
  });

  it('hides the built-in level badge for session/custom playable entries', () => {
    const sessionEntry = upsertSessionPlayableEntry({
      level: {
        id: 'custom-level-1',
        name: 'Custom Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    });
    const store = createAppStore();

    store.dispatch(
      handleLevelChange(parseLevel(sessionEntry.level), {
        levelRef: sessionEntry.ref,
        levelId: sessionEntry.level.id,
        exactLevelKey: createPlayableExactLevelKey(sessionEntry.level),
      }),
    );

    const { html } = renderPage(store);

    expect(html).not.toContain('Level 1');
    expect(html).not.toMatch(/Level \d+/);
  });

  it('uses the provided board skin preference for the play canvas', () => {
    renderPageWithSkin('legacy');

    expect(testState.gameCanvasProps?.skinId).toBe('legacy');
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

  it('renders an unavailable shell when the active level id is unknown', () => {
    const store = createAppStore();
    store.dispatch(nextLevel({ levelId: 'missing-level' }));
    store.dispatch(move({ direction: 'L', changed: true, pushed: false }));

    const { html } = renderPage(store);

    expect(html).toContain('Active level is unavailable');
    expect(testState.sidePanelProps).toBeNull();
  });

  it('renders an unavailable shell instead of exposing next-level transitions from unknown ids', () => {
    const store = createAppStore();
    store.dispatch(nextLevel({ levelId: 'missing-level' }));
    const { html } = renderPage(store);

    expect(html).toContain('Active level is unavailable');
    expect(testState.sidePanelProps).toBeNull();
  });

  it('wires side-panel and sequence controls into the play shell', () => {
    const store = createAppStore();
    store.dispatch(move({ direction: 'L', changed: true, pushed: false }));

    renderPage(store);

    const onUndo = testState.sidePanelProps?.onUndo as (() => void) | undefined;
    const onRestart = testState.sidePanelProps?.onRestart as (() => void) | undefined;
    const onReplaySpeedChange = testState.bottomControlsProps?.onReplaySpeedChange as
      | ((speed: number) => void)
      | undefined;

    expect(onUndo).toBeTypeOf('function');
    expect(onRestart).toBeTypeOf('function');
    expect(testState.bottomControlsProps?.onAnimateSequence).toBeTypeOf('function');
    expect(onReplaySpeedChange).toBeTypeOf('function');
    expect(testState.bottomControlsProps?.replaySpeed).toBe(2);

    onUndo?.();
    expect(store.getState().game.stats.moves).toBe(0);

    onReplaySpeedChange?.(3);
    expect(store.getState().settings.solverReplaySpeed).toBe(3);

    onRestart?.();
    expect(store.getState().game.stats.moves).toBe(0);
    expect(store.getState().game.stats.pushes).toBe(0);
  });

  it('no-ops undo and animate-solution when there is no history or solution', () => {
    const store = createAppStore();
    renderPage(store);

    const onUndo = testState.sidePanelProps?.onUndo as (() => void) | undefined;
    const onAnimate = testState.solverPanelProps?.onAnimate as (() => void) | undefined;
    expect(onUndo).toBeTypeOf('function');
    expect(onAnimate).toBeTypeOf('function');

    const beforeMoves = store.getState().game.stats.moves;
    onUndo?.();
    onAnimate?.();

    expect(store.getState().game.stats.moves).toBe(beforeMoves);
  });

  it('wires the move-sequence animator callback into bottom controls', () => {
    const store = createAppStore();
    renderPage(store);

    expect(testState.bottomControlsProps?.onAnimateSequence).toBeTypeOf('function');
    expect(testState.bottomControlsProps?.replaySpeed).toBe(
      store.getState().settings.solverReplaySpeed,
    );
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

  it('ignores invalid solver algorithm selections from the panel callback', () => {
    const { store } = renderPage();
    const initialAlgorithmId = store.getState().solver.selectedAlgorithmId;

    const onSelectAlgorithm = testState.solverPanelProps?.onSelectAlgorithm as
      | ((algorithmId: string) => void)
      | undefined;
    expect(onSelectAlgorithm).toBeTypeOf('function');

    onSelectAlgorithm?.('not-a-real-algorithm');

    expect(store.getState().solver.selectedAlgorithmId).toBe(initialAlgorithmId);
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

  it('keeps imported pack navigation scoped to the active session collection', () => {
    const importedBuiltinA = builtinLevels[0];
    const importedBuiltinB = builtinLevels[1];

    if (!importedBuiltinA || !importedBuiltinB) {
      const { store } = renderPage();
      expect(store.getState().game.levelId).toBeDefined();
      return;
    }

    const importedEntries = upsertSessionPlayableCollection([
      {
        originRef: toBuiltinLevelRef(importedBuiltinB.id),
        level: importedBuiltinB,
      },
      {
        originRef: toBuiltinLevelRef(importedBuiltinA.id),
        level: importedBuiltinA,
      },
    ]);
    const store = createAppStore();

    store.dispatch(
      handleLevelChange(parseLevel(importedEntries[0].level), {
        levelRef: importedEntries[0].ref,
        levelId: importedEntries[0].level.id,
        exactLevelKey: createPlayableExactLevelKey(importedEntries[0].level),
      }),
    );
    renderPage(store);

    expect(testState.sidePanelProps?.levelId).toBe(importedBuiltinB.id);
    expect(testState.sidePanelProps?.showLevelNavigation).toBe(true);
    expect(testState.sidePanelProps?.canGoToPreviousLevel).toBe(false);

    const onNextLevel = testState.sidePanelProps?.onNextLevel as (() => void) | undefined;
    expect(onNextLevel).toBeTypeOf('function');

    onNextLevel?.();
    expect(store.getState().game.activeLevelRef).toBe(importedEntries[1].ref);
    expect(store.getState().game.levelId).toBe(importedBuiltinA.id);

    renderPage(store);
    expect(testState.sidePanelProps?.canGoToPreviousLevel).toBe(true);

    const onPreviousLevel = testState.sidePanelProps?.onPreviousLevel as (() => void) | undefined;
    expect(onPreviousLevel).toBeTypeOf('function');

    onPreviousLevel?.();
    expect(store.getState().game.activeLevelRef).toBe(importedEntries[0].ref);
    expect(store.getState().game.levelId).toBe(importedBuiltinB.id);
  });

  it('hides level-sequence navigation for one-off session handoffs and keeps next-level a no-op', () => {
    const sessionEntry = upsertSessionPlayableEntry({
      level: {
        id: 'single-session-level',
        name: 'Single Session Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    });
    const store = createAppStore();

    store.dispatch(
      handleLevelChange(parseLevel(sessionEntry.level), {
        levelRef: sessionEntry.ref,
        levelId: sessionEntry.level.id,
        exactLevelKey: createPlayableExactLevelKey(sessionEntry.level),
      }),
    );
    renderPage(store);

    expect(testState.sidePanelProps?.showLevelNavigation).toBe(false);
    expect(testState.sidePanelProps?.canGoToPreviousLevel).toBe(false);

    const onNextLevel = testState.sidePanelProps?.onNextLevel as (() => void) | undefined;
    expect(onNextLevel).toBeTypeOf('function');

    onNextLevel?.();

    expect(store.getState().game.activeLevelRef).toBe(sessionEntry.ref);
    expect(store.getState().game.levelId).toBe(sessionEntry.level.id);
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

  it('keeps the current level when previous-level navigation is requested from the first built-in level', () => {
    const store = createAppStore();
    const initialLevelId = store.getState().game.levelId;
    renderPage(store);

    const onPreviousLevel = testState.sidePanelProps?.onPreviousLevel as (() => void) | undefined;
    expect(onPreviousLevel).toBeTypeOf('function');

    onPreviousLevel?.();

    expect(store.getState().game.levelId).toBe(initialLevelId);
    expect(store.getState().game.stats.moves).toBe(0);
    expect(store.getState().game.stats.pushes).toBe(0);
  });

  it('renders an unavailable shell when the active session ref disappears from the playable catalog', () => {
    const sessionEntry = upsertSessionPlayableEntry({
      level: {
        id: 'active-session-level',
        name: 'Active Session Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    });
    const store = createAppStore();

    store.dispatch(
      handleLevelChange(parseLevel(sessionEntry.level), {
        levelRef: sessionEntry.ref,
        levelId: sessionEntry.level.id,
        exactLevelKey: createPlayableExactLevelKey(sessionEntry.level),
      }),
    );
    clearSessionPlayableEntries();

    const { html } = renderPage(store);

    expect(html).toContain('Active level is unavailable');
    expect(html).not.toContain('Game board');
    expect(testState.sidePanelProps).toBeNull();
  });

  it('renders an unavailable shell when a reused session ref no longer matches the active exact level key', () => {
    const originalLevel = {
      id: 'active-session-level',
      name: 'Original Session Level',
      rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
    };
    const updatedLevel = {
      id: 'active-session-level',
      name: 'Updated Session Level',
      rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
    };
    const sessionEntry = upsertSessionPlayableEntry({
      ref: 'temp:active-session-reused',
      level: originalLevel,
    });
    const store = createAppStore();

    store.dispatch(
      handleLevelChange(parseLevel(sessionEntry.level), {
        levelRef: sessionEntry.ref,
        levelId: sessionEntry.level.id,
        exactLevelKey: createPlayableExactLevelKey(sessionEntry.level),
      }),
    );
    upsertSessionPlayableEntry({
      ref: sessionEntry.ref,
      level: updatedLevel,
    });

    const { html } = renderPage(store);

    expect(createPlayableLevelFingerprint(updatedLevel)).not.toBe(
      createPlayableLevelFingerprint(originalLevel),
    );
    expect(html).toContain('Active level version is unavailable');
    expect(testState.sidePanelProps).toBeNull();
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
});
