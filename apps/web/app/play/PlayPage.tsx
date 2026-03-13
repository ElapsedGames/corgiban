import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  applyMove,
  applyMoves,
  createGame,
  isWin,
  parseLevel,
  type GameState,
} from '@corgiban/core';
import type { Direction } from '@corgiban/shared';
import { ALGORITHM_IDS, type AlgorithmId } from '@corgiban/solver';

import { RequestedEntryPendingPage } from '../levels/RequestedEntryPending';
import { RequestedEntryUnavailablePage } from '../levels/RequestedEntryUnavailable';
import { createPlayableExactLevelKey } from '../levels/playableIdentity';
import { resolveRequestedPlayableEntryFromEntries } from '../levels/requestedPlayableEntry';
import { GameCanvas } from '../canvas/GameCanvas';
import { isBuiltinLevelId, type PlayableEntry } from '../levels/temporaryLevelCatalog';
import { buildBenchHref, buildLabHref, buildPlayHref } from '../navigation/handoffLinks';
import { usePlayableCatalogSnapshot, useResolvedPlayableEntry } from '../levels/usePlayableLevels';
import { ReplayController } from '../replay/replayController.client';
import type { AppDispatch, RootState } from '../state';
import {
  applyRequestedAlgorithmSelection,
  cancelSolve,
  handleLevelChange,
  retryWorker,
  startSolve,
} from '../state';
import { applyMoveSequence, move, restart, undo, type GameMove } from '../state/gameSlice';
import { setSolverReplaySpeed } from '../state/settingsSlice';
import { clearReplay, setSelectedAlgorithmId } from '../state/solverSlice';
import type { SolverResultState, SolverRunStatus } from '../state/solverSlice';
import { BottomControls } from './BottomControls';
import { SidePanel } from './SidePanel';
import { SolverPanel } from './SolverPanel';
import { useBoardPointerControls } from './useBoardPointerControls';
import { useKeyboardControls } from './useKeyboardControls';
import { getMaxWidthMediaQuery } from '../ui/responsive';
import { useMediaQuery } from '../ui/useMediaQuery';

const boardAnimateScrollMediaQuery = getMaxWidthMediaQuery('lg');
const unknownPlayableFallback: PlayableEntry = {
  ref: 'builtin:level-unknown',
  source: { kind: 'builtin' },
  level: {
    id: 'level-unknown',
    name: 'Unknown',
    rows: ['P'],
  },
};

function isKnownAlgorithmId(value: string | null | undefined): value is AlgorithmId {
  return !!value && ALGORITHM_IDS.includes(value as AlgorithmId);
}

function getPlayableEntryByRef(levelRef: string, levelsByRef: Map<string, PlayableEntry>) {
  return levelsByRef.get(levelRef) ?? null;
}

function compareScopedSessionEntries(left: PlayableEntry, right: PlayableEntry): number {
  const leftIndex =
    left.source.kind === 'session' && typeof left.source.collectionIndex === 'number'
      ? left.source.collectionIndex
      : Number.MAX_SAFE_INTEGER;
  const rightIndex =
    right.source.kind === 'session' && typeof right.source.collectionIndex === 'number'
      ? right.source.collectionIndex
      : Number.MAX_SAFE_INTEGER;

  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  return left.ref.localeCompare(right.ref);
}

function getScopedLevelOrder(activePlayableEntry: PlayableEntry, playableLevels: PlayableEntry[]) {
  if (activePlayableEntry.source.kind === 'builtin') {
    return playableLevels
      .filter((entry) => entry.source.kind === 'builtin')
      .map((entry) => entry.ref);
  }

  const activeCollectionRef =
    activePlayableEntry.source.kind === 'session'
      ? activePlayableEntry.source.collectionRef
      : undefined;

  if (activeCollectionRef) {
    return playableLevels
      .filter(
        (entry) =>
          entry.source.kind === 'session' && entry.source.collectionRef === activeCollectionRef,
      )
      .sort(compareScopedSessionEntries)
      .map((entry) => entry.ref);
  }

  return [activePlayableEntry.ref];
}

function getNextLevelRef(levelRef: string, levelOrder: string[]) {
  if (levelOrder.length === 0) {
    return levelRef;
  }

  const index = levelOrder.indexOf(levelRef);
  if (index === -1) {
    return levelOrder[0];
  }

  const nextIndex = (index + 1) % levelOrder.length;
  return levelOrder[nextIndex];
}

function getPreviousLevelRef(levelRef: string, levelOrder: string[]) {
  if (levelOrder.length === 0) {
    return levelRef;
  }

  const index = levelOrder.indexOf(levelRef);
  if (index <= 0) {
    return levelOrder[0];
  }

  return levelOrder[index - 1];
}

function buildState(levelState: ReturnType<typeof parseLevel>, history: Direction[]): GameState {
  const base = createGame(levelState);
  if (history.length === 0) {
    return base;
  }

  return applyMoves(base, history).state;
}

function parseSolutionMoves(solutionMoves: string | undefined): Direction[] {
  if (!solutionMoves) {
    return [];
  }

  const directions: Direction[] = [];
  for (const char of solutionMoves) {
    if (char === 'U' || char === 'D' || char === 'L' || char === 'R') {
      directions.push(char);
    }
  }
  return directions;
}

function scrollBoardToViewportTop(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  const boardSection = document.getElementById('game-board');
  if (!(boardSection instanceof HTMLElement)) {
    return;
  }

  const stickyHeader = document.querySelector('.app-nav');
  const stickyHeaderHeight =
    stickyHeader instanceof HTMLElement ? stickyHeader.getBoundingClientRect().height : 0;
  const boardTop = boardSection.getBoundingClientRect().top + window.scrollY - stickyHeaderHeight;

  window.scrollTo({
    top: Math.max(boardTop, 0),
    behavior: 'auto',
  });
}

function isMobileSolverFailureOutcome(
  status: SolverRunStatus,
  lastResult: SolverResultState | null,
): boolean {
  if (status === 'failed') {
    return true;
  }

  if (status === 'cancelled') {
    return false;
  }

  return status === 'succeeded' && lastResult?.status !== 'solved';
}

function buildRouteSignature(params: {
  requestedLevelRef?: string | null;
  requestedLevelId?: string | null;
  requestedExactLevelKey?: string | null;
  requestedAlgorithmId?: AlgorithmId | null;
}): string {
  return JSON.stringify({
    levelRef: params.requestedLevelRef ?? null,
    levelId: params.requestedLevelId ?? null,
    exactLevelKey: params.requestedExactLevelKey ?? null,
    algorithmId: params.requestedAlgorithmId ?? null,
  });
}

function buildPlayableHandoffTarget(level: PlayableEntry): {
  levelId?: string;
  levelRef?: string;
  exactLevelKey?: string;
} {
  return {
    levelId: level.level.id,
    levelRef: level.ref,
    exactLevelKey: createPlayableExactLevelKey(level.level),
  };
}

export type PlayPageProps = {
  requestedLevelId?: string | null;
  requestedLevelRef?: string | null;
  requestedExactLevelKey?: string | null;
  requestedAlgorithmId?: AlgorithmId | null;
};

export function PlayPage({
  requestedLevelId,
  requestedLevelRef,
  requestedExactLevelKey,
  requestedAlgorithmId,
}: PlayPageProps = {}) {
  const dispatch = useDispatch<AppDispatch>();
  const {
    activeLevelRef,
    exactLevelKey: activeExactLevelKey,
    history,
    levelId,
    stats,
  } = useSelector((state: RootState) => state.game);
  const solver = useSelector((state: RootState) => state.solver);
  const replaySpeed = useSelector((state: RootState) => state.settings.solverReplaySpeed);
  const appliedRouteSignatureRef = useRef<string | null>(null);
  const playableCatalog = usePlayableCatalogSnapshot();
  const playableLevels = playableCatalog.entries;
  const requestedPlayableEntry = useResolvedPlayableEntry({
    levelRef: requestedLevelRef,
    levelId: requestedLevelId,
    exactLevelKey: requestedExactLevelKey,
  });
  const levelsByRef = useMemo(
    () => new Map(playableLevels.map((level) => [level.ref, level] as const)),
    [playableLevels],
  );
  const activePlayableResolution = useMemo(() => {
    return resolveRequestedPlayableEntryFromEntries(
      playableLevels,
      {
        levelRef: activeLevelRef,
        levelId,
        exactLevelKey: activeExactLevelKey,
      },
      { completeness: playableCatalog.completeness },
    );
  }, [activeExactLevelKey, activeLevelRef, levelId, playableCatalog.completeness, playableLevels]);
  const activePlayableEntry =
    activePlayableResolution.status === 'resolved' ? activePlayableResolution.entry : null;
  const activePlayableRef = activePlayableEntry?.ref ?? activeLevelRef;
  const levelOrder = useMemo(
    () => (activePlayableEntry ? getScopedLevelOrder(activePlayableEntry, playableLevels) : []),
    [activePlayableEntry, playableLevels],
  );
  const currentLevelIndex = useMemo(
    () => (activePlayableEntry ? levelOrder.indexOf(activePlayableEntry.ref) : -1),
    [activePlayableEntry, levelOrder],
  );
  const canGoToPreviousLevel = currentLevelIndex > 0;
  const fallbackLevelRuntime = useMemo(() => parseLevel(unknownPlayableFallback.level), []);
  const levelRuntime = useMemo(
    () => (activePlayableEntry ? parseLevel(activePlayableEntry.level) : null),
    [activePlayableEntry],
  );
  const moveDirections = useMemo(() => history.map((moveEntry) => moveEntry.direction), [history]);
  const gameState = useMemo(
    () => (levelRuntime ? buildState(levelRuntime, moveDirections) : null),
    [levelRuntime, moveDirections],
  );
  const solved = useMemo(() => (gameState ? isWin(gameState) : false), [gameState]);
  const shouldAutoScrollBoardOnAnimate = useMediaQuery(boardAnimateScrollMediaQuery);
  const handoffTarget = useMemo(
    () => (activePlayableEntry ? buildPlayableHandoffTarget(activePlayableEntry) : null),
    [activePlayableEntry],
  );
  const labHref = handoffTarget ? buildLabHref(handoffTarget) : '/lab';
  const benchHref = handoffTarget ? buildBenchHref(handoffTarget) : '/bench';

  useEffect(() => {
    if (!levelRuntime) {
      return;
    }

    if (solver.recommendation) {
      return;
    }

    dispatch(applyRequestedAlgorithmSelection(levelRuntime));
  }, [dispatch, levelRuntime, solver.recommendation]);

  useEffect(() => {
    if (
      !requestedLevelRef &&
      !requestedLevelId &&
      !requestedExactLevelKey &&
      !requestedAlgorithmId
    ) {
      appliedRouteSignatureRef.current = null;
      return;
    }

    const nextRouteSignature = buildRouteSignature({
      requestedLevelRef,
      requestedLevelId,
      requestedExactLevelKey,
      requestedAlgorithmId,
    });
    if (appliedRouteSignatureRef.current === nextRouteSignature) {
      return;
    }

    const hasRequestedLevel = Boolean(
      requestedLevelRef || requestedLevelId || requestedExactLevelKey,
    );
    if (hasRequestedLevel && !requestedPlayableEntry) {
      return;
    }

    if (requestedPlayableEntry && requestedPlayableEntry.ref !== activePlayableRef) {
      appliedRouteSignatureRef.current = nextRouteSignature;
      dispatch(
        handleLevelChange(parseLevel(requestedPlayableEntry.level), {
          levelRef: requestedPlayableEntry.ref,
          levelId: requestedPlayableEntry.level.id,
          exactLevelKey: createPlayableExactLevelKey(requestedPlayableEntry.level),
          pendingAlgorithmId: requestedAlgorithmId,
        }),
      );
      return;
    }

    if (!levelRuntime) {
      return;
    }

    if (requestedAlgorithmId) {
      appliedRouteSignatureRef.current = nextRouteSignature;
      dispatch(applyRequestedAlgorithmSelection(levelRuntime, requestedAlgorithmId));
      return;
    }

    appliedRouteSignatureRef.current = nextRouteSignature;
  }, [
    activePlayableRef,
    dispatch,
    levelRuntime,
    requestedAlgorithmId,
    requestedExactLevelKey,
    requestedLevelId,
    requestedLevelRef,
    requestedPlayableEntry,
  ]);

  const gameStateRef = useRef(gameState ?? createGame(fallbackLevelRuntime));
  useEffect(() => {
    if (gameState) {
      gameStateRef.current = gameState;
    }
  }, [gameState]);

  const replayControllerRef = useRef<ReplayController | null>(null);
  const replaySpeedRef = useRef(replaySpeed);
  const [replayShadowState, setReplayShadowState] = useState<GameState | null>(null);
  const [mobileSolverRunLockedLevelRef, setMobileSolverRunLockedLevelRef] = useState<string | null>(
    null,
  );
  const previousMobileFailureOutcomeRef = useRef(
    isMobileSolverFailureOutcome(solver.status, solver.lastResult),
  );

  useEffect(() => {
    replaySpeedRef.current = replaySpeed;
  }, [replaySpeed]);

  useEffect(() => {
    setMobileSolverRunLockedLevelRef(null);
  }, [activePlayableRef]);

  useEffect(() => {
    const nextMobileFailureOutcome = isMobileSolverFailureOutcome(solver.status, solver.lastResult);
    if (!previousMobileFailureOutcomeRef.current && nextMobileFailureOutcome) {
      setMobileSolverRunLockedLevelRef(activePlayableRef);
    }

    previousMobileFailureOutcomeRef.current = nextMobileFailureOutcome;
  }, [activePlayableRef, solver.lastResult, solver.status]);

  useEffect(() => {
    if (!levelRuntime) {
      replayControllerRef.current = null;
      setReplayShadowState(null);
      dispatch(clearReplay());
      return;
    }

    const controller = new ReplayController({
      level: levelRuntime,
      dispatch,
      getReplaySpeed: () => replaySpeedRef.current,
      onStateChange: (state) => {
        setReplayShadowState(state);
      },
    });

    replayControllerRef.current = controller;
    setReplayShadowState(null);
    dispatch(clearReplay());

    return () => {
      controller.pause();
      if (replayControllerRef.current === controller) {
        replayControllerRef.current = null;
      }
    };
  }, [dispatch, levelRuntime]);

  const stopReplay = useCallback(() => {
    replayControllerRef.current?.stop();
    setReplayShadowState(null);
    dispatch(clearReplay());
  }, [dispatch]);

  const handleMove = useCallback(
    (direction: Direction) => {
      if (!levelRuntime) {
        return;
      }

      stopReplay();
      const result = applyMove(gameStateRef.current, direction);
      if (result.changed) {
        gameStateRef.current = result.state;
      }
      dispatch(move({ direction, pushed: result.pushed, changed: result.changed }));
    },
    [dispatch, stopReplay],
  );

  const handleUndo = useCallback(() => {
    if (!levelRuntime) {
      return;
    }

    stopReplay();
    if (history.length === 0) {
      return;
    }
    dispatch(undo());
    gameStateRef.current = buildState(levelRuntime, moveDirections.slice(0, -1));
  }, [dispatch, history.length, levelRuntime, moveDirections, stopReplay]);

  const handleRestart = useCallback(() => {
    if (!levelRuntime) {
      return;
    }

    stopReplay();
    dispatch(restart());
    gameStateRef.current = createGame(levelRuntime);
  }, [dispatch, levelRuntime, stopReplay]);

  const handlePreviousLevel = useCallback(() => {
    if (!activePlayableEntry || !canGoToPreviousLevel) {
      return;
    }

    stopReplay();
    const previousLevelRef = getPreviousLevelRef(activePlayableEntry.ref, levelOrder);
    const previousPlayableEntry = getPlayableEntryByRef(previousLevelRef, levelsByRef);
    if (!previousPlayableEntry) {
      return;
    }

    dispatch(
      handleLevelChange(parseLevel(previousPlayableEntry.level), {
        levelRef: previousPlayableEntry.ref,
        levelId: previousPlayableEntry.level.id,
        exactLevelKey: createPlayableExactLevelKey(previousPlayableEntry.level),
      }),
    );
    gameStateRef.current = createGame(parseLevel(previousPlayableEntry.level));
  }, [activePlayableEntry, canGoToPreviousLevel, dispatch, levelOrder, levelsByRef, stopReplay]);

  const handleNextLevel = useCallback(() => {
    if (!activePlayableEntry) {
      return;
    }

    stopReplay();
    const nextLevelRef = getNextLevelRef(activePlayableEntry.ref, levelOrder);
    const nextPlayableEntry = getPlayableEntryByRef(nextLevelRef, levelsByRef);
    if (!nextPlayableEntry) {
      return;
    }

    dispatch(
      handleLevelChange(parseLevel(nextPlayableEntry.level), {
        levelRef: nextPlayableEntry.ref,
        levelId: nextPlayableEntry.level.id,
        exactLevelKey: createPlayableExactLevelKey(nextPlayableEntry.level),
      }),
    );
    gameStateRef.current = createGame(parseLevel(nextPlayableEntry.level));
  }, [activePlayableEntry, dispatch, levelOrder, levelsByRef, stopReplay]);

  const handleApplySequence = useCallback(
    (directions: Direction[]) => {
      const baseState = gameStateRef.current;
      const baseHistoryLength = baseState.history.length;
      const result = applyMoves(baseState, directions, { stopOnNoChange: true });
      const appliedCount = Math.min(
        directions.length,
        Math.max(0, result.state.history.length - baseHistoryLength),
      );

      if (appliedCount === 0) {
        return { applied: 0, stoppedAt: result.stoppedAt ?? null };
      }

      const newHistory = result.state.history.slice(
        baseHistoryLength,
        baseHistoryLength + appliedCount,
      );
      const appliedMoves: GameMove[] = newHistory.map((entry, index) => ({
        direction: directions[index],
        pushed: entry.pushed,
      }));

      dispatch(applyMoveSequence({ moves: appliedMoves }));
      gameStateRef.current = result.state;

      return { applied: appliedMoves.length, stoppedAt: result.stoppedAt ?? null };
    },
    [dispatch],
  );

  const latestSolutionDirections = useMemo(
    () => parseSolutionMoves(solver.lastResult?.solutionMoves),
    [solver.lastResult?.solutionMoves],
  );

  const handleRunSolver = useCallback(() => {
    if (!levelRuntime) {
      return;
    }

    void dispatch(
      startSolve({
        levelRuntime,
        algorithmId: solver.selectedAlgorithmId ?? undefined,
      }),
    );
  }, [dispatch, levelRuntime, solver.selectedAlgorithmId]);

  const handleCancelSolver = useCallback(() => {
    dispatch(cancelSolve());
  }, [dispatch]);

  const handleRetryWorker = useCallback(() => {
    dispatch(retryWorker());
  }, [dispatch]);

  const handleSelectAlgorithm = useCallback(
    (algorithmId: AlgorithmId) => {
      if (!isKnownAlgorithmId(algorithmId)) {
        return;
      }

      dispatch(setSelectedAlgorithmId(algorithmId));
    },
    [dispatch],
  );

  const handleApplySolution = useCallback(() => {
    if (!levelRuntime) {
      return;
    }

    if (latestSolutionDirections.length === 0) {
      return;
    }
    stopReplay();
    dispatch(restart());
    gameStateRef.current = createGame(levelRuntime);
    handleApplySequence(latestSolutionDirections);
  }, [dispatch, handleApplySequence, latestSolutionDirections, levelRuntime, stopReplay]);

  const handleAnimateSolution = useCallback(() => {
    if (latestSolutionDirections.length === 0) {
      return;
    }
    if (shouldAutoScrollBoardOnAnimate) {
      scrollBoardToViewportTop();
    }
    replayControllerRef.current?.loadSolution(latestSolutionDirections, true);
  }, [latestSolutionDirections, shouldAutoScrollBoardOnAnimate]);

  useEffect(() => {
    if (!levelRuntime) {
      return;
    }

    if (solver.replayState !== 'done') {
      return;
    }
    if (latestSolutionDirections.length === 0) {
      return;
    }
    dispatch(restart());
    gameStateRef.current = createGame(levelRuntime);
    handleApplySequence(latestSolutionDirections);
    setReplayShadowState(null);
    dispatch(clearReplay());
  }, [solver.replayState, latestSolutionDirections, dispatch, levelRuntime, handleApplySequence]);

  const handleReplayPlayPause = useCallback(() => {
    const controller = replayControllerRef.current;
    if (!controller) {
      return;
    }
    if (solver.replayState === 'playing') {
      controller.pause();
      return;
    }
    controller.start();
  }, [solver.replayState]);

  const handleReplayStepBack = useCallback(() => {
    replayControllerRef.current?.stepBack();
  }, []);

  const handleReplayStepForward = useCallback(() => {
    replayControllerRef.current?.stepForward();
  }, []);

  const handleReplaySpeedChange = useCallback(
    (speed: number) => {
      dispatch(setSolverReplaySpeed(speed));
    },
    [dispatch],
  );

  useKeyboardControls({
    onMove: handleMove,
    onUndo: handleUndo,
    onRestart: handleRestart,
    onNextLevel: handleNextLevel,
    isSolved: solved,
  });

  const getCurrentGameState = useCallback(() => gameStateRef.current, []);
  const [boardCanvasNode, setBoardCanvasNode] = useState<HTMLCanvasElement | null>(null);
  useBoardPointerControls(boardCanvasNode, {
    getGameState: getCurrentGameState,
    onMove: handleMove,
  });

  const canvasState = replayShadowState ?? gameState ?? gameStateRef.current;
  const mobileSolverRunLocked = mobileSolverRunLockedLevelRef === activePlayableRef;

  if (activePlayableResolution.status === 'pendingClientCatalog') {
    return (
      <RequestedEntryPendingPage
        routeTitle="Play"
        routeSubtitle="Open exact session-scoped levels here. Session-backed levels restore after the browser catalog hydrates."
        heading="Restoring active level"
        message="The current play session depends on browser-session level data that has not finished loading yet."
      />
    );
  }

  if (!activePlayableEntry || !levelRuntime) {
    const fallbackLevelId =
      activePlayableResolution.status === 'missingLevelId'
        ? activePlayableResolution.requestedLevelId
        : activePlayableResolution.status === 'missingExactRef' ||
            activePlayableResolution.status === 'missingExactKey'
          ? activePlayableResolution.fallbackLevelId
          : undefined;
    const fallbackActions =
      fallbackLevelId && isBuiltinLevelId(fallbackLevelId)
        ? [{ label: 'Open Built-In', to: buildPlayHref({ levelId: fallbackLevelId }) }]
        : [];

    return (
      <RequestedEntryUnavailablePage
        routeTitle="Play"
        routeSubtitle="Open exact session-scoped levels here. Missing active levels fail closed instead of loading a different puzzle."
        heading={
          activePlayableResolution.status === 'missingExactKey'
            ? 'Active level version is unavailable'
            : 'Active level is unavailable'
        }
        message={
          activePlayableResolution.status === 'missingExactKey'
            ? 'The exact playable version for the active session is no longer available, so Play will not swap to a different board.'
            : 'The active playable entry is no longer available in the current catalog, so Play will not substitute a different board.'
        }
        requestedIdentity={
          activePlayableResolution.status === 'missingLevelId'
            ? activePlayableResolution.requestedLevelId
            : activePlayableResolution.status === 'missingExactRef'
              ? activePlayableResolution.requestedRef
              : activePlayableResolution.status === 'missingExactKey'
                ? (activePlayableResolution.requestedRef ??
                  activePlayableResolution.requestedLevelId ??
                  activePlayableResolution.requestedExactLevelKey)
                : activeLevelRef
        }
        actions={[
          ...fallbackActions,
          { label: 'Open Bench', to: '/bench' },
          { label: 'Open Lab', to: '/lab' },
        ]}
      />
    );
  }

  return (
    <main id="main-content" className="page-shell play-shell" aria-label="Play Corgiban">
      {solved ? (
        <div role="status" aria-live="polite" className="sr-only">
          Level solved!
        </div>
      ) : null}

      <div className="mt-3 grid gap-4 lg:gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
        <div className="order-2 flex min-w-0 flex-col gap-6 lg:order-1">
          <SidePanel
            levelName={activePlayableEntry.level.name}
            levelId={activePlayableEntry.level.id}
            stats={stats}
            moves={history}
            isSolved={solved}
            labHref={labHref}
            benchHref={benchHref}
            canGoToPreviousLevel={canGoToPreviousLevel}
            onPreviousLevel={handlePreviousLevel}
            onRestart={handleRestart}
            onUndo={handleUndo}
            onNextLevel={handleNextLevel}
          />

          <div className="hidden lg:block">
            <BottomControls onApplySequence={handleApplySequence} />
          </div>
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-6 lg:order-2">
          <section
            id="game-board"
            aria-labelledby="board-heading"
            className="-mx-7 border-y border-border bg-panel px-4 py-4 shadow-none lg:mx-0 lg:rounded-app-lg lg:border lg:px-6 lg:py-6 lg:shadow-lg"
          >
            <h2 id="board-heading" className="sr-only">
              Game board
            </h2>
            <div className="mb-4 flex items-start justify-between gap-3 lg:hidden">
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold text-fg">
                  {activePlayableEntry.level.name}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-bold text-white shadow-sm ${
                  solved ? '' : 'invisible'
                }`}
              >
                <span aria-hidden="true">&#10003;</span>
                Solved
              </span>
            </div>
            <div className="mb-4 hidden gap-3 md:grid-cols-[minmax(0,1fr)_minmax(14rem,20rem)] md:items-start lg:grid">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted">Board</p>
                <h2 className="mt-1 text-xl font-semibold text-fg">
                  {activePlayableEntry.level.name}
                </h2>
                <p className="mt-1 text-sm text-muted">{activePlayableEntry.level.id}</p>
              </div>
              <div className="flex flex-col gap-2 md:items-end">
                <span
                  className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted"
                  aria-label={`${levelRuntime.width} columns by ${levelRuntime.height} rows`}
                >
                  {levelRuntime.width} x {levelRuntime.height}
                </span>
                {solved ? (
                  <div className="flex w-full items-center gap-2 rounded-app-md border border-success-border bg-success-surface px-3 py-2 text-sm font-semibold text-success-text shadow-sm md:max-w-[20rem]">
                    <span aria-hidden="true">&#10003;</span>
                    Puzzle solved!
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex justify-center bg-bg px-2 py-2 sm:px-3 sm:py-3 lg:rounded-app-md lg:p-4">
              <GameCanvas
                state={canvasState}
                className="mx-auto block max-w-full touch-none"
                cellSize={56}
                canvasRef={setBoardCanvasNode}
              />
            </div>
            <p className="mt-3 hidden text-center text-xs text-muted lg:block">
              Swipe or click/tap adjacent tiles &middot; Arrow keys or WASD &middot; U to undo
              &middot; R to restart
            </p>
          </section>
        </div>

        <div className="order-3 flex min-w-0 flex-col gap-6 lg:col-span-2 xl:col-span-1">
          <div className="xl:sticky xl:top-24">
            <SolverPanel
              recommendation={solver.recommendation}
              selectedAlgorithmId={solver.selectedAlgorithmId}
              status={solver.status}
              progress={solver.progress}
              lastResult={solver.lastResult}
              error={solver.error}
              workerHealth={solver.workerHealth}
              replayState={solver.replayState}
              replayIndex={solver.replayIndex}
              replayTotalSteps={solver.replayTotalSteps}
              replaySpeed={replaySpeed}
              mobileRunLocked={mobileSolverRunLocked}
              onSelectAlgorithm={handleSelectAlgorithm}
              onRun={handleRunSolver}
              onCancel={handleCancelSolver}
              onApply={handleApplySolution}
              onAnimate={handleAnimateSolution}
              onReplayPlayPause={handleReplayPlayPause}
              onReplayStepBack={handleReplayStepBack}
              onReplayStepForward={handleReplayStepForward}
              onReplaySpeedChange={handleReplaySpeedChange}
              onRetryWorker={handleRetryWorker}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
