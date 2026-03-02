import { useCallback, useEffect, useMemo, useRef } from 'react';
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

import { GameCanvas } from '../canvas/GameCanvas';
import type { AppDispatch, RootState } from '../state';
import {
  applyMoveSequence,
  move,
  nextLevel,
  restart,
  undo,
  type GameMove,
} from '../state/gameSlice';
import { BottomControls } from './BottomControls';
import { SidePanel } from './SidePanel';
import { useKeyboardControls } from './useKeyboardControls';

const fallbackLevel = builtinLevels[0] ?? {
  id: 'level-unknown',
  name: 'Unknown',
  rows: ['P'],
};
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

function buildState(levelState: ReturnType<typeof parseLevel>, history: Direction[]): GameState {
  const base = createGame(levelState);
  if (history.length === 0) {
    return base;
  }

  return applyMoves(base, history).state;
}

export function PlayPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { levelId, history, stats } = useSelector((state: RootState) => state.game);

  const levelDefinition = useMemo(() => getLevelById(levelId), [levelId]);
  const levelRuntime = useMemo(() => parseLevel(levelDefinition), [levelDefinition]);
  const moveDirections = useMemo(() => history.map((moveEntry) => moveEntry.direction), [history]);
  const gameState = useMemo(
    () => buildState(levelRuntime, moveDirections),
    [levelRuntime, moveDirections],
  );
  const solved = useMemo(() => isWin(gameState), [gameState]);

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const handleMove = useCallback(
    (direction: Direction) => {
      const result = applyMove(gameStateRef.current, direction);
      if (result.changed) {
        gameStateRef.current = result.state;
      }
      dispatch(move({ direction, pushed: result.pushed, changed: result.changed }));
    },
    [dispatch],
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0) {
      return;
    }
    dispatch(undo());
    gameStateRef.current = buildState(levelRuntime, moveDirections.slice(0, -1));
  }, [dispatch, history.length, levelRuntime, moveDirections]);

  const handleRestart = useCallback(() => {
    dispatch(restart());
    gameStateRef.current = createGame(levelRuntime);
  }, [dispatch, levelRuntime]);

  const handleNextLevel = useCallback(() => {
    const nextId = getNextLevelId(levelDefinition.id);
    dispatch(nextLevel({ levelId: nextId }));
    const nextDefinition = getLevelById(nextId);
    gameStateRef.current = createGame(parseLevel(nextDefinition));
  }, [dispatch, levelDefinition.id]);

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

  useKeyboardControls({
    onMove: handleMove,
    onUndo: handleUndo,
    onRestart: handleRestart,
    onNextLevel: handleNextLevel,
  });

  return (
    <main className="page-shell">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">Play</p>
          <h1 className="page-title">Corgiban</h1>
          <p className="page-subtitle">
            Use arrow keys or WASD to move. U to undo, R to restart, N for next level.
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-4 py-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
            Current level
          </div>
          <div className="font-semibold">{levelDefinition.name}</div>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SidePanel
          levelName={levelDefinition.name}
          levelId={levelDefinition.id}
          stats={stats}
          moves={history}
          isSolved={solved}
          onRestart={handleRestart}
          onUndo={handleUndo}
          onNextLevel={handleNextLevel}
        />

        <div className="flex flex-col gap-6">
          <section className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
              <span>Board</span>
              <span>
                {levelRuntime.width} x {levelRuntime.height}
              </span>
            </div>
            <div className="flex justify-center rounded-[var(--radius-md)] bg-[color:var(--color-bg)] p-3">
              <GameCanvas state={gameState} className="max-w-full" cellSize={32} />
            </div>
          </section>

          <BottomControls onApplySequence={handleApplySequence} />
        </div>
      </div>
    </main>
  );
}
