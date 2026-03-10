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
import { builtinLevels } from '@corgiban/levels';
import type { Direction } from '@corgiban/shared';
import type { AlgorithmId } from '@corgiban/solver';

import { GameCanvas } from '../canvas/GameCanvas';
import { ReplayController } from '../replay/replayController.client';
import type { AppDispatch, RootState } from '../state';
import { cancelSolve, handleLevelChange, retryWorker, startSolve } from '../state';
import {
  applyMoveSequence,
  move,
  nextLevel,
  restart,
  undo,
  type GameMove,
} from '../state/gameSlice';
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

const fallbackLevel = builtinLevels[0] ?? {
  id: 'level-unknown',
  name: 'Unknown',
  rows: ['P'],
};
const boardAnimateScrollMediaQuery = getMaxWidthMediaQuery('lg');
const levelOrder = builtinLevels.map((level) => level.id);
const levelsById = new Map(builtinLevels.map((level) => [level.id, level]));

function getLevelById(levelId: string) {
  return levelsById.get(levelId) ?? fallbackLevel;
}

function getNextLevelId(levelId: string) {
  if (levelOrder.length === 0) {
    return levelId;
  }

  const index = levelOrder.indexOf(levelId);
  if (index === -1) {
    return levelOrder[0];
  }

  const nextIndex = (index + 1) % levelOrder.length;
  return levelOrder[nextIndex];
}

function getPreviousLevelId(levelId: string) {
  if (levelOrder.length === 0) {
    return levelId;
  }

  const index = levelOrder.indexOf(levelId);
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

export function PlayPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { levelId, history, stats } = useSelector((state: RootState) => state.game);
  const solver = useSelector((state: RootState) => state.solver);
  const replaySpeed = useSelector((state: RootState) => state.settings.solverReplaySpeed);

  const levelDefinition = useMemo(() => getLevelById(levelId), [levelId]);
  const currentLevelIndex = useMemo(
    () => levelOrder.indexOf(levelDefinition.id),
    [levelDefinition.id],
  );
  const canGoToPreviousLevel = currentLevelIndex > 0;
  const levelRuntime = useMemo(() => parseLevel(levelDefinition), [levelDefinition]);
  const moveDirections = useMemo(() => history.map((moveEntry) => moveEntry.direction), [history]);
  const gameState = useMemo(
    () => buildState(levelRuntime, moveDirections),
    [levelRuntime, moveDirections],
  );
  const solved = useMemo(() => isWin(gameState), [gameState]);
  const shouldAutoScrollBoardOnAnimate = useMediaQuery(boardAnimateScrollMediaQuery);

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const replayControllerRef = useRef<ReplayController | null>(null);
  const replaySpeedRef = useRef(replaySpeed);
  const [replayShadowState, setReplayShadowState] = useState<GameState | null>(null);
  const [mobileSolverRunLockedLevelId, setMobileSolverRunLockedLevelId] = useState<string | null>(
    null,
  );
  const previousMobileFailureOutcomeRef = useRef(
    isMobileSolverFailureOutcome(solver.status, solver.lastResult),
  );

  useEffect(() => {
    replaySpeedRef.current = replaySpeed;
  }, [replaySpeed]);

  useEffect(() => {
    setMobileSolverRunLockedLevelId(null);
  }, [levelDefinition.id]);

  useEffect(() => {
    const nextMobileFailureOutcome = isMobileSolverFailureOutcome(solver.status, solver.lastResult);
    if (!previousMobileFailureOutcomeRef.current && nextMobileFailureOutcome) {
      setMobileSolverRunLockedLevelId(levelDefinition.id);
    }

    previousMobileFailureOutcomeRef.current = nextMobileFailureOutcome;
  }, [levelDefinition.id, solver.lastResult, solver.status]);

  useEffect(() => {
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
    dispatch(handleLevelChange(levelRuntime));

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
    stopReplay();
    if (history.length === 0) {
      return;
    }
    dispatch(undo());
    gameStateRef.current = buildState(levelRuntime, moveDirections.slice(0, -1));
  }, [dispatch, history.length, levelRuntime, moveDirections, stopReplay]);

  const handleRestart = useCallback(() => {
    stopReplay();
    dispatch(restart());
    gameStateRef.current = createGame(levelRuntime);
  }, [dispatch, levelRuntime, stopReplay]);

  const handlePreviousLevel = useCallback(() => {
    if (!canGoToPreviousLevel) {
      return;
    }

    stopReplay();
    const previousId = getPreviousLevelId(levelDefinition.id);
    dispatch(nextLevel({ levelId: previousId }));
    const previousDefinition = getLevelById(previousId);
    gameStateRef.current = createGame(parseLevel(previousDefinition));
  }, [canGoToPreviousLevel, dispatch, levelDefinition.id, stopReplay]);

  const handleNextLevel = useCallback(() => {
    stopReplay();
    const nextId = getNextLevelId(levelDefinition.id);
    dispatch(nextLevel({ levelId: nextId }));
    const nextDefinition = getLevelById(nextId);
    gameStateRef.current = createGame(parseLevel(nextDefinition));
  }, [dispatch, levelDefinition.id, stopReplay]);

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
      dispatch(setSelectedAlgorithmId(algorithmId));
    },
    [dispatch],
  );

  const handleApplySolution = useCallback(() => {
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

  const canvasState = replayShadowState ?? gameState;
  const mobileSolverRunLocked = mobileSolverRunLockedLevelId === levelDefinition.id;

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
            levelName={levelDefinition.name}
            levelId={levelDefinition.id}
            stats={stats}
            moves={history}
            isSolved={solved}
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
                <p className="truncate text-xl font-semibold text-fg">{levelDefinition.name}</p>
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
                <h2 className="mt-1 text-xl font-semibold text-fg">{levelDefinition.name}</h2>
                <p className="mt-1 text-sm text-muted">{levelDefinition.id}</p>
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
