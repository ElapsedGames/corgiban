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
import { useBoardSkinPreference } from '../canvas/useAppBoardSkin';
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
import { MoveHistory } from './MoveHistory';
import { SidePanel } from './SidePanel';
import { SolverPanel } from './SolverPanel';
import { usePlayProgress } from './usePlayProgress';
import { useBoardPointerControls } from './useBoardPointerControls';
import { useKeyboardControls } from './useKeyboardControls';
import { getMaxWidthMediaQuery } from '../ui/responsive';
import { Tooltip } from '../ui/Tooltip';
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
const PLAY_DEFAULT_ALGORITHM_ID: AlgorithmId = 'greedyPush';

function isKnownAlgorithmId(value: string | null | undefined): value is AlgorithmId {
  return !!value && ALGORITHM_IDS.includes(value as AlgorithmId);
}

function resolvePlayAlgorithmSelection(
  requestedAlgorithmId: AlgorithmId | null | undefined,
): AlgorithmId {
  return isKnownAlgorithmId(requestedAlgorithmId)
    ? requestedAlgorithmId
    : PLAY_DEFAULT_ALGORITHM_ID;
}

function clearPlayHandoffQueryParams(options: {
  requestedLevelRef?: string | null;
  requestedLevelId?: string | null;
  requestedExactLevelKey?: string | null;
  activePlayableEntry?: PlayableEntry | null;
}): void {
  if (typeof window === 'undefined') {
    return;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hasSessionExactHandoff =
    options.requestedLevelRef?.startsWith('temp:') ||
    (Boolean(options.requestedExactLevelKey) &&
      options.activePlayableEntry?.source.kind === 'session');

  if (hasSessionExactHandoff) {
    searchParams.delete('levelRef');
    searchParams.delete('levelId');
    searchParams.delete('exactLevelKey');
    searchParams.delete('algorithmId');
  } else if (options.requestedLevelRef || options.requestedExactLevelKey) {
    if (options.activePlayableEntry?.source.kind === 'builtin') {
      searchParams.set('levelId', options.activePlayableEntry.level.id);
    }
    searchParams.delete('levelRef');
    searchParams.delete('exactLevelKey');
  } else {
    return;
  }

  const nextSearch = searchParams.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) {
    return;
  }

  window.history.replaceState(window.history.state, '', nextUrl);
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

function cloneGameStateSnapshot(state: GameState): GameState {
  return {
    level: state.level,
    playerIndex: state.playerIndex,
    boxes: new Uint32Array(state.boxes),
    history: [...state.history],
    stats: { ...state.stats },
  };
}

type SequencePlaybackPlan = {
  appliedMoves: GameMove[];
  nextState: GameState;
  stoppedAt: number | null;
};

function buildSequencePlaybackPlan(
  baseState: GameState,
  directions: Direction[],
): SequencePlaybackPlan {
  const baseHistoryLength = baseState.history.length;
  const result = applyMoves(baseState, directions, { stopOnNoChange: true });
  const appliedCount = Math.min(
    directions.length,
    Math.max(0, result.state.history.length - baseHistoryLength),
  );

  if (appliedCount === 0) {
    return {
      appliedMoves: [],
      nextState: baseState,
      stoppedAt: result.stoppedAt ?? null,
    };
  }

  const newHistory = result.state.history.slice(
    baseHistoryLength,
    baseHistoryLength + appliedCount,
  );
  return {
    appliedMoves: newHistory.map((entry, index: number) => ({
      direction: directions[index],
      pushed: entry.pushed,
    })),
    nextState: result.state,
    stoppedAt: result.stoppedAt ?? null,
  };
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
  requestedAlgorithmId?: string | null;
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
  const { boardSkinId } = useBoardSkinPreference();
  const { isPlayProgressReady, markCompletedLevel, playProgress, rememberLastPlayedLevel } =
    usePlayProgress();
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
  const builtinLevelLabel =
    activePlayableEntry?.source.kind === 'builtin' && currentLevelIndex >= 0
      ? `Level ${currentLevelIndex + 1}`
      : null;
  const showLevelNavigation = levelOrder.length > 1;
  const canGoToPreviousLevel = currentLevelIndex > 0;
  const fallbackLevelRuntime = useMemo(() => parseLevel(unknownPlayableFallback.level), []);
  const levelRuntime = useMemo(
    () => (activePlayableEntry ? parseLevel(activePlayableEntry.level) : null),
    [activePlayableEntry],
  );
  const moveDirections = useMemo(
    () => history.map((moveEntry: GameMove) => moveEntry.direction),
    [history],
  );
  const gameState = useMemo(
    () => (levelRuntime ? buildState(levelRuntime, moveDirections) : null),
    [levelRuntime, moveDirections],
  );
  const gameStateRef = useRef(gameState ?? createGame(fallbackLevelRuntime));
  const solved = useMemo(() => (gameState ? isWin(gameState) : false), [gameState]);
  const shouldAutoScrollBoardOnAnimate = useMediaQuery(boardAnimateScrollMediaQuery);
  const [playProgressBootstrap, setPlayProgressBootstrap] = useState<
    { status: 'pending' } | { status: 'restoring'; targetRef: string } | { status: 'ready' }
  >({ status: 'pending' });
  const handoffTarget = useMemo(
    () => (activePlayableEntry ? buildPlayableHandoffTarget(activePlayableEntry) : null),
    [activePlayableEntry],
  );
  const labHref = handoffTarget ? buildLabHref(handoffTarget) : '/lab';
  const benchHref = handoffTarget ? buildBenchHref(handoffTarget) : '/bench';
  const hasRequestedLevelIdentity = Boolean(
    requestedLevelRef || requestedLevelId || requestedExactLevelKey,
  );

  useEffect(() => {
    if (!levelRuntime) {
      return;
    }

    if (solver.recommendation) {
      return;
    }

    dispatch(
      applyRequestedAlgorithmSelection(
        levelRuntime,
        resolvePlayAlgorithmSelection(requestedAlgorithmId),
      ),
    );
  }, [dispatch, levelRuntime, requestedAlgorithmId, solver.recommendation]);

  useEffect(() => {
    if (!isPlayProgressReady || playProgressBootstrap.status !== 'pending') {
      return;
    }

    if (hasRequestedLevelIdentity) {
      setPlayProgressBootstrap({ status: 'ready' });
      return;
    }

    const lastPlayedLevel = playProgress?.lastPlayedLevel;
    if (!lastPlayedLevel) {
      setPlayProgressBootstrap({ status: 'ready' });
      return;
    }

    const restoration = resolveRequestedPlayableEntryFromEntries(
      playableLevels,
      {
        levelRef: lastPlayedLevel.levelRef,
        levelId: lastPlayedLevel.levelId,
      },
      { completeness: playableCatalog.completeness },
    );

    if (restoration.status !== 'resolved') {
      setPlayProgressBootstrap({ status: 'ready' });
      return;
    }

    if (restoration.entry.source.kind !== 'builtin') {
      setPlayProgressBootstrap({ status: 'ready' });
      return;
    }

    if (restoration.entry.ref === activePlayableRef) {
      setPlayProgressBootstrap({ status: 'ready' });
      return;
    }

    const restoredLevelRuntime = parseLevel(restoration.entry.level);
    dispatch(
      handleLevelChange(restoredLevelRuntime, {
        levelRef: restoration.entry.ref,
        levelId: restoration.entry.level.id,
        exactLevelKey: createPlayableExactLevelKey(restoration.entry.level),
        pendingAlgorithmId: solver.selectedAlgorithmId ?? PLAY_DEFAULT_ALGORITHM_ID,
      }),
    );
    gameStateRef.current = createGame(restoredLevelRuntime);
    setPlayProgressBootstrap({ status: 'restoring', targetRef: restoration.entry.ref });
  }, [
    activePlayableRef,
    dispatch,
    hasRequestedLevelIdentity,
    isPlayProgressReady,
    playableCatalog.completeness,
    playableLevels,
    playProgress?.lastPlayedLevel,
    playProgressBootstrap.status,
    solver.selectedAlgorithmId,
  ]);

  useEffect(() => {
    if (playProgressBootstrap.status !== 'restoring') {
      return;
    }

    if (activePlayableRef !== playProgressBootstrap.targetRef) {
      return;
    }

    setPlayProgressBootstrap({ status: 'ready' });
  }, [activePlayableRef, playProgressBootstrap]);

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
          pendingAlgorithmId: resolvePlayAlgorithmSelection(requestedAlgorithmId),
        }),
      );
      return;
    }

    if (!levelRuntime) {
      return;
    }

    if (requestedAlgorithmId) {
      appliedRouteSignatureRef.current = nextRouteSignature;
      dispatch(
        applyRequestedAlgorithmSelection(
          levelRuntime,
          resolvePlayAlgorithmSelection(requestedAlgorithmId),
        ),
      );
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

  useEffect(() => {
    if (
      !requestedLevelRef &&
      !requestedLevelId &&
      !requestedExactLevelKey &&
      !requestedAlgorithmId
    ) {
      return;
    }

    if (!activePlayableEntry) {
      return;
    }

    clearPlayHandoffQueryParams({
      requestedLevelRef,
      requestedLevelId,
      requestedExactLevelKey,
      activePlayableEntry,
    });
  }, [
    activePlayableEntry,
    requestedAlgorithmId,
    requestedExactLevelKey,
    requestedLevelId,
    requestedLevelRef,
  ]);

  useEffect(() => {
    if (gameState) {
      gameStateRef.current = gameState;
    }
  }, [gameState]);

  const replayControllerRef = useRef<ReplayController | null>(null);
  const replaySpeedRef = useRef(replaySpeed);
  const pendingReplayPlanRef = useRef<{
    baseState: GameState;
    directions: Direction[];
    resetStoreBeforeCommit: boolean;
  } | null>(null);
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
    pendingReplayPlanRef.current = null;
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
    pendingReplayPlanRef.current = null;
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
        pendingAlgorithmId: PLAY_DEFAULT_ALGORITHM_ID,
      }),
    );
    gameStateRef.current = createGame(parseLevel(previousPlayableEntry.level));
  }, [activePlayableEntry, canGoToPreviousLevel, dispatch, levelOrder, levelsByRef, stopReplay]);

  const handleNextLevel = useCallback(() => {
    if (!activePlayableEntry || levelOrder.length <= 1) {
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
        pendingAlgorithmId: PLAY_DEFAULT_ALGORITHM_ID,
      }),
    );
    gameStateRef.current = createGame(parseLevel(nextPlayableEntry.level));
  }, [activePlayableEntry, dispatch, levelOrder, levelsByRef, stopReplay]);

  const commitSequence = useCallback(
    (directions: Direction[], baseState: GameState = gameStateRef.current) => {
      const playbackPlan = buildSequencePlaybackPlan(baseState, directions);

      if (playbackPlan.appliedMoves.length === 0) {
        return { applied: 0, stoppedAt: playbackPlan.stoppedAt };
      }

      dispatch(applyMoveSequence({ moves: playbackPlan.appliedMoves }));
      gameStateRef.current = playbackPlan.nextState;

      return {
        applied: playbackPlan.appliedMoves.length,
        stoppedAt: playbackPlan.stoppedAt,
      };
    },
    [dispatch],
  );

  const handleAnimateSequence = useCallback(
    (directions: Direction[]) => {
      const controller = replayControllerRef.current;
      if (!controller) {
        return { applied: 0, stoppedAt: null };
      }
      const baseState = cloneGameStateSnapshot(gameStateRef.current);
      const playbackPlan = buildSequencePlaybackPlan(baseState, directions);

      if (playbackPlan.appliedMoves.length === 0) {
        return { applied: 0, stoppedAt: playbackPlan.stoppedAt };
      }

      stopReplay();
      const replayDirections = playbackPlan.appliedMoves.map((moveEntry) => moveEntry.direction);
      const replayBaseState = cloneGameStateSnapshot(baseState);
      pendingReplayPlanRef.current = {
        baseState: replayBaseState,
        directions: replayDirections,
        resetStoreBeforeCommit: false,
      };
      controller.loadMovesFromState(replayBaseState, replayDirections, true);

      return {
        applied: replayDirections.length,
        stoppedAt: playbackPlan.stoppedAt,
      };
    },
    [stopReplay],
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
        algorithmId: solver.selectedAlgorithmId ?? PLAY_DEFAULT_ALGORITHM_ID,
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
    commitSequence(latestSolutionDirections);
  }, [commitSequence, dispatch, latestSolutionDirections, levelRuntime, stopReplay]);

  const handleAnimateSolution = useCallback(() => {
    const controller = replayControllerRef.current;
    if (!controller || !levelRuntime || latestSolutionDirections.length === 0) {
      return;
    }
    if (shouldAutoScrollBoardOnAnimate) {
      scrollBoardToViewportTop();
    }
    const replayBaseState = createGame(levelRuntime);
    pendingReplayPlanRef.current = {
      baseState: replayBaseState,
      directions: latestSolutionDirections,
      resetStoreBeforeCommit: true,
    };
    controller.loadMovesFromState(replayBaseState, latestSolutionDirections, true);
  }, [latestSolutionDirections, levelRuntime, shouldAutoScrollBoardOnAnimate]);

  useEffect(() => {
    if (solver.replayState !== 'done') {
      return;
    }
    const pendingReplayPlan =
      pendingReplayPlanRef.current ??
      (levelRuntime && latestSolutionDirections.length > 0
        ? {
            baseState: createGame(levelRuntime),
            directions: latestSolutionDirections,
            resetStoreBeforeCommit: true,
          }
        : null);
    if (!pendingReplayPlan) {
      return;
    }
    pendingReplayPlanRef.current = null;
    if (pendingReplayPlan.resetStoreBeforeCommit) {
      dispatch(restart());
    }
    gameStateRef.current = cloneGameStateSnapshot(pendingReplayPlan.baseState);
    commitSequence(pendingReplayPlan.directions, pendingReplayPlan.baseState);
    setReplayShadowState(null);
    dispatch(clearReplay());
  }, [commitSequence, dispatch, solver.replayState]);

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
    canGoToNextLevel: showLevelNavigation,
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

  useEffect(() => {
    if (
      !isPlayProgressReady ||
      playProgressBootstrap.status !== 'ready' ||
      !activePlayableEntry ||
      activePlayableEntry.source.kind !== 'builtin'
    ) {
      return;
    }

    rememberLastPlayedLevel({
      levelRef: activePlayableEntry.ref,
      levelId: activePlayableEntry.level.id,
    });
  }, [
    activePlayableEntry,
    isPlayProgressReady,
    playProgressBootstrap.status,
    rememberLastPlayedLevel,
  ]);

  useEffect(() => {
    if (
      !isPlayProgressReady ||
      playProgressBootstrap.status !== 'ready' ||
      !solved ||
      !activePlayableEntry ||
      activePlayableEntry.source.kind !== 'builtin'
    ) {
      return;
    }

    markCompletedLevel(activePlayableEntry.level.id);
  }, [
    activePlayableEntry,
    isPlayProgressReady,
    markCompletedLevel,
    playProgressBootstrap.status,
    solved,
  ]);

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

      <header aria-label="Play" className="page-header hidden lg:block">
        <h1 className="page-title">Play</h1>
        <p className="page-subtitle">
          Play the current puzzle, watch your move history, and run a worker solve when you want a
          hint, replay, or algorithm comparison.
        </p>
      </header>

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
            showLevelNavigation={showLevelNavigation}
            canGoToPreviousLevel={canGoToPreviousLevel}
            onPreviousLevel={handlePreviousLevel}
            onRestart={handleRestart}
            onUndo={handleUndo}
            onNextLevel={handleNextLevel}
          />

          <div className="hidden lg:block">
            <BottomControls
              replaySpeed={replaySpeed}
              onAnimateSequence={handleAnimateSequence}
              onReplaySpeedChange={handleReplaySpeedChange}
            />
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
            <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-semibold text-fg">
                  {activePlayableEntry.level.name}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-bold text-white shadow-sm ${
                    solved ? '' : 'invisible'
                  }`}
                >
                  <span aria-hidden="true">&#10003;</span>
                  Solved
                </span>
                {builtinLevelLabel ? (
                  <span className="rounded-full border border-border bg-bg/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    {builtinLevelLabel}
                  </span>
                ) : null}
              </div>
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
                <div className="flex flex-wrap justify-end gap-2">
                  <span
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted"
                    aria-label={`${levelRuntime.width} columns by ${levelRuntime.height} rows`}
                  >
                    {levelRuntime.width} x {levelRuntime.height}
                  </span>
                  {builtinLevelLabel ? (
                    <span className="rounded-full border border-border bg-bg/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      {builtinLevelLabel}
                    </span>
                  ) : null}
                </div>
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
                skinId={boardSkinId}
                className="mx-auto block max-w-full touch-none"
                cellSize={56}
                canvasRef={setBoardCanvasNode}
              />
            </div>
            {solved ? (
              <div className="mt-4 lg:hidden">
                <MoveHistory moves={history} mode="copyOnly" />
              </div>
            ) : null}
            <div className="mt-3 hidden items-center justify-center gap-2 text-xs text-muted lg:flex">
              <span>Controls</span>
              <Tooltip
                content="Swipe or click or tap an adjacent tile to move. You can also use Arrow keys or WASD. Press U to undo and R to restart."
                align="center"
              >
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Board controls help"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-panel text-[10px] font-bold leading-none text-muted"
                >
                  i
                </span>
              </Tooltip>
            </div>
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
