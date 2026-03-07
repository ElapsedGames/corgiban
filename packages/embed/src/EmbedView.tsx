import type { Direction, GameState, LevelRuntime } from '@corgiban/core';
import {
  applyMove,
  createGame,
  isTarget as isTargetCell,
  isWall as isWallCell,
  isWin,
  parseLevel,
} from '@corgiban/core';
import { builtinLevels, normalizeLevelDefinition, type LevelDefinition } from '@corgiban/levels';
import { MAX_IMPORT_BYTES } from '@corgiban/shared';
import { useEffect, useMemo, useState } from 'react';

const directionOrder: Direction[] = ['U', 'D', 'L', 'R'];

type EmbedViewProps = {
  level: EmbedLevelResolution;
  readonly: boolean;
  showSolver: boolean;
  theme: string;
  onMoveEvent: (detail: {
    direction: Direction;
    changed: boolean;
    pushed: boolean;
    moves: number;
    pushes: number;
    solved: boolean;
  }) => void;
  onSolvedEvent: (detail: {
    moves: number;
    pushes: number;
    source: 'manual' | 'known-solution';
  }) => void;
  onBenchmarkCompleteEvent: (detail: {
    source: 'known-solution';
    elapsedMs: number;
    moveCount: number;
    solved: boolean;
    synthetic: true;
  }) => void;
};

type RuntimeSnapshot = {
  levelRuntime: LevelRuntime;
  levelName: string;
};

export type EmbedResolutionError = {
  code: 'invalid-level-data' | 'invalid-level-id';
  message: string;
  levelId: string | null;
};

type ResolvedLevel = RuntimeSnapshot & {
  status: 'resolved';
  levelDefinition: LevelDefinition;
  cacheKey: string;
};

type InvalidResolvedLevel = {
  status: 'invalid';
  error: EmbedResolutionError;
  cacheKey: string;
};

export type EmbedLevelResolution = ResolvedLevel | InvalidResolvedLevel;

function toRows(state: GameState): string[] {
  const rows: string[] = [];
  const boxSet = new Set(state.boxes);

  for (let row = 0; row < state.level.height; row += 1) {
    let line = '';
    for (let col = 0; col < state.level.width; col += 1) {
      const index = row * state.level.width + col;
      const staticCell = state.level.staticGrid[index];
      const isWall = isWallCell(staticCell);
      const isTarget = isTargetCell(staticCell);
      const hasPlayer = index === state.playerIndex;
      const hasBox = boxSet.has(index);

      if (isWall) {
        line += '#';
      } else if (hasPlayer && isTarget) {
        line += '+';
      } else if (hasPlayer) {
        line += '@';
      } else if (hasBox && isTarget) {
        line += '*';
      } else if (hasBox) {
        line += '$';
      } else if (isTarget) {
        line += '.';
      } else {
        line += ' ';
      }
    }
    rows.push(line);
  }

  return rows;
}

function invalidResolution(
  code: EmbedResolutionError['code'],
  levelId: string | null,
  message: string,
  cacheKey: string,
): InvalidResolvedLevel {
  return {
    status: 'invalid',
    cacheKey,
    error: {
      code,
      message,
      levelId,
    },
  };
}

function invalidLevelData(
  levelId: string | null,
  message: string,
  cacheKey: string,
): InvalidResolvedLevel {
  return invalidResolution('invalid-level-data', levelId, message, cacheKey);
}

function invalidLevelId(levelId: string): InvalidResolvedLevel {
  return invalidResolution(
    'invalid-level-id',
    levelId,
    `Unknown level-id "${levelId}".`,
    `invalid-level-id:${levelId}`,
  );
}

function createRuntimeSnapshot(levelDefinition: LevelDefinition): RuntimeSnapshot {
  return {
    levelRuntime: parseLevel(levelDefinition),
    levelName: levelDefinition.name,
  };
}

function tryCreateRuntimeSnapshot(levelDefinition: LevelDefinition): RuntimeSnapshot | string {
  try {
    return createRuntimeSnapshot(levelDefinition);
  } catch (error) {
    return error instanceof Error ? error.message : 'Unknown level parsing error.';
  }
}

function normalizeRequestedLevelId(levelId: string | null): string | null {
  if (levelId === null || levelId.length === 0) {
    return null;
  }

  return levelId;
}

function findBuiltinLevel(levelId: string): LevelDefinition | null {
  return builtinLevels.find((level) => level.id === levelId) ?? null;
}

function parseKnownSolution(value: string | null | undefined): Direction[] {
  if (!value) {
    return [];
  }

  const directions: Direction[] = [];
  for (const token of value) {
    const normalized = token.toUpperCase();
    if (normalized === 'U' || normalized === 'D' || normalized === 'L' || normalized === 'R') {
      directions.push(normalized);
    }
  }

  return directions;
}

function parseLevelDefinitionFromData(
  levelId: string | null,
  levelData: string,
): EmbedLevelResolution {
  const cacheKeyBase = `level-data:${levelData}`;
  const invalidCacheKey = `invalid-level-data:${levelId ?? ''}:${levelData}`;
  const importBytes = new TextEncoder().encode(levelData).byteLength;
  if (importBytes > MAX_IMPORT_BYTES) {
    const maxMb = (MAX_IMPORT_BYTES / 1024 / 1024).toFixed(1);
    const importMb = (importBytes / 1024 / 1024).toFixed(1);
    return invalidLevelData(
      levelId,
      `level-data is too large (${importMb} MB). Maximum is ${maxMb} MB.`,
      invalidCacheKey,
    );
  }

  try {
    const parsed = JSON.parse(levelData) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return invalidLevelData(levelId, 'level-data must decode to a JSON object.', invalidCacheKey);
    }

    const value = parsed as Partial<LevelDefinition> & {
      rows?: unknown;
      name?: unknown;
      id?: unknown;
    };
    if (!Array.isArray(value.rows) || !value.rows.every((row) => typeof row === 'string')) {
      return invalidLevelData(
        levelId,
        'level-data.rows must be an array of strings.',
        invalidCacheKey,
      );
    }

    const levelDefinition = normalizeLevelDefinition({
      id: typeof value.id === 'string' && value.id.length > 0 ? value.id : 'embed-custom',
      name: typeof value.name === 'string' && value.name.length > 0 ? value.name : 'Embedded Level',
      rows: value.rows,
      knownSolution: typeof value.knownSolution === 'string' ? value.knownSolution : null,
    });

    const runtimeSnapshot = tryCreateRuntimeSnapshot(levelDefinition);
    if (typeof runtimeSnapshot === 'string') {
      return invalidLevelData(
        levelId,
        `level-data does not describe a valid Corgiban level: ${runtimeSnapshot}`,
        invalidCacheKey,
      );
    }

    return {
      status: 'resolved',
      cacheKey: cacheKeyBase,
      levelDefinition,
      ...runtimeSnapshot,
    };
  } catch {
    return invalidLevelData(levelId, 'level-data must be valid JSON.', invalidCacheKey);
  }
}

function InvalidEmbedView({ error, theme }: { error: EmbedResolutionError; theme: string }) {
  return (
    <div className="embed-shell" data-theme={theme} data-state="invalid">
      <header className="embed-header">
        <h2>Embedded level unavailable</h2>
        <p>{error.message}</p>
      </header>
    </div>
  );
}

function ResolvedEmbedView({
  level,
  readonly,
  showSolver,
  theme,
  onMoveEvent,
  onSolvedEvent,
  onBenchmarkCompleteEvent,
}: Omit<EmbedViewProps, 'level'> & { level: ResolvedLevel }) {
  const [state, setState] = useState(() => createGame(level.levelRuntime));

  useEffect(() => {
    setState(createGame(level.levelRuntime));
  }, [level]);

  const solved = isWin(state);
  const rows = useMemo(() => toRows(state), [state]);

  const onMove = (direction: Direction) => {
    if (readonly) {
      return;
    }

    const result = applyMove(state, direction);
    if (!result.changed) {
      onMoveEvent({
        direction,
        changed: false,
        pushed: false,
        moves: state.stats.moves,
        pushes: state.stats.pushes,
        solved,
      });
      return;
    }

    setState(result.state);
    const solvedAfterMove = isWin(result.state);

    onMoveEvent({
      direction,
      changed: true,
      pushed: result.pushed,
      moves: result.state.stats.moves,
      pushes: result.state.stats.pushes,
      solved: solvedAfterMove,
    });

    if (solvedAfterMove) {
      onSolvedEvent({
        moves: result.state.stats.moves,
        pushes: result.state.stats.pushes,
        source: 'manual',
      });
    }
  };

  const onApplyKnownSolution = () => {
    if (readonly) {
      return;
    }

    const directions = parseKnownSolution(level.levelDefinition.knownSolution);
    if (directions.length === 0) {
      onBenchmarkCompleteEvent({
        source: 'known-solution',
        elapsedMs: 0,
        moveCount: 0,
        solved: false,
        synthetic: true,
      });
      return;
    }

    const startedAt = globalThis.performance?.now() ?? Date.now();
    let currentState = createGame(level.levelRuntime);

    directions.forEach((direction) => {
      const step = applyMove(currentState, direction);
      if (step.changed) {
        currentState = step.state;
      }
    });

    const endedAt = globalThis.performance?.now() ?? Date.now();
    setState(currentState);

    const solvedAfterKnown = isWin(currentState);
    if (solvedAfterKnown) {
      onSolvedEvent({
        moves: currentState.stats.moves,
        pushes: currentState.stats.pushes,
        source: 'known-solution',
      });
    }

    onBenchmarkCompleteEvent({
      source: 'known-solution',
      elapsedMs: Math.max(0, endedAt - startedAt),
      moveCount: currentState.stats.moves,
      solved: solvedAfterKnown,
      synthetic: true,
    });
  };

  return (
    <div className="embed-shell" data-theme={theme}>
      <header className="embed-header">
        <h2>{level.levelName}</h2>
        <p>
          Moves: {state.stats.moves} | Pushes: {state.stats.pushes} |{' '}
          {solved ? 'Solved' : 'In progress'}
        </p>
      </header>

      <pre className="embed-board" aria-label="Embedded board">
        {rows.join('\n')}
      </pre>

      <div className="embed-controls">
        {directionOrder.map((direction) => (
          <button
            key={direction}
            type="button"
            onClick={() => onMove(direction)}
            disabled={readonly}
          >
            {direction}
          </button>
        ))}

        {showSolver ? (
          <button type="button" onClick={onApplyKnownSolution} disabled={readonly}>
            Apply Known Solution
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function EmbedView(props: EmbedViewProps) {
  if (props.level.status === 'invalid') {
    return <InvalidEmbedView error={props.level.error} theme={props.theme} />;
  }

  return <ResolvedEmbedView {...props} level={props.level} />;
}

export function resolveEmbedLevelDefinition(
  levelId: string | null,
  levelData: string | null,
): EmbedLevelResolution {
  const normalizedLevelId = normalizeRequestedLevelId(levelId);

  if (normalizedLevelId !== null) {
    const builtinLevel = findBuiltinLevel(normalizedLevelId);
    if (builtinLevel) {
      return {
        status: 'resolved',
        cacheKey: `builtin:${builtinLevel.id}`,
        levelDefinition: builtinLevel,
        ...createRuntimeSnapshot(builtinLevel),
      };
    }
  }

  if (levelData !== null) {
    return parseLevelDefinitionFromData(normalizedLevelId, levelData);
  }

  if (normalizedLevelId !== null) {
    return invalidLevelId(normalizedLevelId);
  }

  return invalidLevelData(
    null,
    'Embed requires either a valid level-id or valid level-data.',
    'missing-level-source',
  );
}
