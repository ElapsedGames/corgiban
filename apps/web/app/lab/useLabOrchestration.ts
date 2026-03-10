import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { applyMove, applyMoves, createGame, parseLevel, type GameState } from '@corgiban/core';
import type { Direction } from '@corgiban/shared';
import {
  DEFAULT_NODE_BUDGET,
  DEFAULT_SOLVER_TIME_BUDGET_MS,
  analyzeLevel,
  chooseAlgorithm,
} from '@corgiban/solver';

import { exportTextFile, importTextFile } from '../bench/fileAccess.client';
import { makeRunId } from '../runId';
import {
  LAB_INPUT_FORMAT_LABELS,
  convertLabInputFormat,
  defaultLabLevelText,
  parseLabInput,
  type LabInputFormat,
} from './labFormat';
import { subscribeLabKeyboardControls } from './labKeyboard';
import { createLabPayload, parseLabPayload } from './labPayload';
import { toDirectionArray } from './labStatus';
import type { BenchState, ParseState, RunToken, SolveState } from './labTypes';
import { useLabOwnedPorts } from './useLabOwnedPorts';

type InitialLabData = {
  defaultInput: string;
  parsed: ReturnType<typeof parseLabInput>;
};

export type LabOrchestrationState = {
  format: LabInputFormat;
  input: string;
  parseState: ParseState;
  previewState: GameState;
  solveState: SolveState;
  benchState: BenchState;
  setFormat: (format: LabInputFormat) => void;
  setInput: (input: string) => void;
  applyParse: () => void;
  movePreview: (direction: Direction) => void;
  resetPreview: () => void;
  runSolve: () => void;
  cancelSolve: () => void;
  applySolution: () => void;
  runBench: () => void;
  importLabPayload: () => void;
  exportLabPayload: () => void;
};

function createInitialLabData(): InitialLabData {
  const defaultInput = defaultLabLevelText();

  return {
    defaultInput,
    parsed: parseLabInput('corg', defaultInput),
  };
}

function isSolveCancelledError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'SolverRunCancelledError';
}

function isBenchCancelledError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'BenchmarkRunCancelledError';
}

export function useLabOrchestration(): LabOrchestrationState {
  const initialLabRef = useRef<InitialLabData>();
  const authoredRevisionRef = useRef(0);
  const activeSolveRunRef = useRef<RunToken | null>(null);
  const activeBenchRunRef = useRef<RunToken | null>(null);

  if (!initialLabRef.current) {
    initialLabRef.current = createInitialLabData();
  }

  const { solverPortRef, benchmarkPortRef } = useLabOwnedPorts({
    activeSolveRunRef,
    activeBenchRunRef,
  });

  const [format, setFormatState] = useState<LabInputFormat>('corg');
  const [input, setInput] = useState(initialLabRef.current.defaultInput);
  const [parseState, setParseState] = useState<ParseState>(() => {
    const parsed = initialLabRef.current?.parsed ?? createInitialLabData().parsed;
    return {
      message: 'Parsed successfully.',
      isError: false,
      levelName: parsed.level.name,
      levelId: parsed.level.id,
    };
  });
  const [activeLevel, setActiveLevel] = useState(() => {
    return initialLabRef.current?.parsed.level ?? createInitialLabData().parsed.level;
  });
  const [previewState, setPreviewState] = useState(() => createGame(parseLevel(activeLevel)));
  const [solveState, setSolveState] = useState<SolveState>({ status: 'idle' });
  const [benchState, setBenchState] = useState<BenchState>({ status: 'idle' });

  const authoredLevelRuntime = useMemo(() => parseLevel(activeLevel), [activeLevel]);
  const movePreview = useCallback((direction: Direction) => {
    setPreviewState((current) => {
      const step = applyMove(current, direction);
      return step.changed ? step.state : current;
    });
  }, []);

  const isActiveRun = (activeRun: RunToken | null, candidate: RunToken) => {
    return (
      activeRun?.runId === candidate.runId &&
      activeRun.authoredRevision === candidate.authoredRevision
    );
  };

  const cancelSolveRun = (nextState: SolveState) => {
    const activeRun = activeSolveRunRef.current;
    if (activeRun) {
      solverPortRef.current?.cancelSolve(activeRun.runId);
      activeSolveRunRef.current = null;
    }
    setSolveState(nextState);
  };

  const cancelBenchRun = (nextState: BenchState) => {
    const activeRun = activeBenchRunRef.current;
    if (activeRun) {
      benchmarkPortRef.current?.cancelSuite(activeRun.runId);
      activeBenchRunRef.current = null;
    }
    setBenchState(nextState);
  };

  const commitParsedLevel = (parsed: ReturnType<typeof parseLabInput>, message: string) => {
    authoredRevisionRef.current += 1;
    cancelSolveRun({ status: 'idle' });
    cancelBenchRun({ status: 'idle' });

    const nextRuntime = parseLevel(parsed.level);
    setActiveLevel(parsed.level);
    setPreviewState(createGame(nextRuntime));
    setFormatState(parsed.normalizedFormat);
    setInput(parsed.normalizedInput);
    setParseState({
      message,
      isError: false,
      levelName: parsed.level.name,
      levelId: parsed.level.id,
    });
  };

  useEffect(() => {
    return subscribeLabKeyboardControls(typeof window === 'undefined' ? undefined : window, {
      onMove: movePreview,
      onReset: () => {
        setPreviewState(createGame(authoredLevelRuntime));
      },
    });
  }, [authoredLevelRuntime, movePreview]);

  const applyParse = () => {
    try {
      const parsed = parseLabInput(format, input);
      commitParsedLevel(parsed, 'Parsed successfully.');
    } catch (error) {
      setParseState({
        message: error instanceof Error ? error.message : 'Failed to parse level input.',
        isError: true,
        levelName: activeLevel.name,
        levelId: activeLevel.id,
      });
    }
  };

  const setFormat = (nextFormat: LabInputFormat) => {
    if (nextFormat === format) {
      return;
    }

    try {
      const converted = convertLabInputFormat(format, nextFormat, input);
      setFormatState(nextFormat);
      setInput(converted.normalizedInput);
      setParseState({
        message: `Converted input to ${LAB_INPUT_FORMAT_LABELS[nextFormat]}. Parse Level to apply it.`,
        isError: false,
        levelName: activeLevel.name,
        levelId: activeLevel.id,
      });
    } catch (error) {
      setParseState({
        message: error instanceof Error ? error.message : 'Failed to convert level input.',
        isError: true,
        levelName: activeLevel.name,
        levelId: activeLevel.id,
      });
    }
  };

  const resetPreview = () => {
    setPreviewState(createGame(authoredLevelRuntime));
  };

  const runSolve = () => {
    void (async () => {
      const solverPort = solverPortRef.current;
      if (!solverPort) {
        return;
      }

      const algorithmId = chooseAlgorithm(analyzeLevel(authoredLevelRuntime));
      const runId = makeRunId('lab-solve');
      const runToken = {
        runId,
        authoredRevision: authoredRevisionRef.current,
      };
      activeSolveRunRef.current = runToken;

      setSolveState({
        status: 'running',
        runId,
        expanded: 0,
        generated: 0,
        elapsedMs: 0,
      });

      try {
        const result = await solverPort.startSolve({
          runId,
          levelRuntime: authoredLevelRuntime,
          algorithmId,
          options: {
            timeBudgetMs: DEFAULT_SOLVER_TIME_BUDGET_MS,
            nodeBudget: DEFAULT_NODE_BUDGET,
            enableSpectatorStream: true,
          },
          onProgress: (progress) => {
            if (!isActiveRun(activeSolveRunRef.current, runToken)) {
              return;
            }
            setSolveState((current) => {
              if (current.status !== 'running' || current.runId !== runId) {
                return current;
              }
              return {
                status: 'running',
                runId,
                expanded: progress.expanded,
                generated: progress.generated,
                elapsedMs: progress.elapsedMs,
              };
            });
          },
        });

        if (!isActiveRun(activeSolveRunRef.current, runToken)) {
          return;
        }

        activeSolveRunRef.current = null;
        if (result.status === 'cancelled') {
          setSolveState({
            status: 'cancelled',
            message: 'Solver run cancelled.',
          });
          return;
        }

        setSolveState({
          status: 'completed',
          algorithmId,
          solutionMoves: result.solutionMoves,
          resultStatus: result.status,
          elapsedMs: result.metrics.elapsedMs,
        });
      } catch (error) {
        if (!isActiveRun(activeSolveRunRef.current, runToken)) {
          return;
        }

        activeSolveRunRef.current = null;
        if (isSolveCancelledError(error)) {
          setSolveState({
            status: 'cancelled',
            message: error.message,
          });
          return;
        }

        setSolveState({
          status: 'failed',
          message: error instanceof Error ? error.message : 'Solver run failed.',
        });
      }
    })();
  };

  const cancelSolve = () => {
    if (solveState.status !== 'running') {
      return;
    }

    cancelSolveRun({
      status: 'cancelled',
      message: 'Solver run cancelled by user.',
    });
  };

  const applySolution = () => {
    if (solveState.status !== 'completed' || !solveState.solutionMoves) {
      return;
    }

    const directions = toDirectionArray(solveState.solutionMoves);
    const applied = applyMoves(createGame(authoredLevelRuntime), directions);
    setPreviewState(applied.state);
  };

  const runBench = () => {
    void (async () => {
      const benchmarkPort = benchmarkPortRef.current;
      if (!benchmarkPort) {
        return;
      }

      const suiteRunId = makeRunId('lab-bench-suite');
      const algorithmId = chooseAlgorithm(analyzeLevel(authoredLevelRuntime));
      const runToken = {
        runId: suiteRunId,
        authoredRevision: authoredRevisionRef.current,
      };
      activeBenchRunRef.current = runToken;

      setBenchState({ status: 'running' });

      try {
        const records = await benchmarkPort.runSuite({
          suiteRunId,
          suite: {
            levelIds: [activeLevel.id],
            algorithmIds: [algorithmId],
            repetitions: 1,
            timeBudgetMs: DEFAULT_SOLVER_TIME_BUDGET_MS,
            nodeBudget: DEFAULT_NODE_BUDGET,
          },
          levelResolver: () => authoredLevelRuntime,
        });

        if (!isActiveRun(activeBenchRunRef.current, runToken)) {
          return;
        }

        const first = records[0];
        if (!first) {
          throw new Error('Benchmark run did not return a result.');
        }

        activeBenchRunRef.current = null;
        if (first.status === 'cancelled') {
          setBenchState({
            status: 'cancelled',
            message: 'Benchmark run cancelled.',
          });
          return;
        }

        setBenchState({
          status: 'completed',
          runId: first.runId,
          resultStatus: first.status,
          elapsedMs: first.metrics.elapsedMs,
          expanded: first.metrics.expanded,
          generated: first.metrics.generated,
        });
      } catch (error) {
        if (!isActiveRun(activeBenchRunRef.current, runToken)) {
          return;
        }

        activeBenchRunRef.current = null;
        if (isBenchCancelledError(error)) {
          setBenchState({
            status: 'cancelled',
            message: error.message,
          });
          return;
        }

        setBenchState({
          status: 'failed',
          message: error instanceof Error ? error.message : 'Benchmark run failed.',
        });
      }
    })();
  };

  const exportLabPayload = () => {
    const payload = createLabPayload({
      format,
      content: input,
      exportedAtIso: new Date().toISOString(),
    });

    void exportTextFile({
      suggestedName: 'corgiban-lab-level.json',
      content: JSON.stringify(payload, null, 2),
    }).catch((error) => {
      setParseState((current) => ({
        ...current,
        isError: true,
        message: error instanceof Error ? error.message : 'Failed to export lab payload.',
      }));
    });
  };

  const importLabPayloadHandler = () => {
    void importTextFile({ acceptMimeTypes: ['application/json'] })
      .then(({ content }) => {
        const payload = parseLabPayload(content);
        const parsed = parseLabInput(payload.format, payload.content);
        commitParsedLevel(parsed, 'Imported lab payload.');
      })
      .catch((error) => {
        setParseState((current) => ({
          ...current,
          isError: true,
          message: error instanceof Error ? error.message : 'Failed to import lab payload.',
        }));
      });
  };

  return {
    format,
    input,
    parseState,
    previewState,
    solveState,
    benchState,
    setFormat,
    setInput,
    applyParse,
    movePreview,
    resetPreview,
    runSolve,
    cancelSolve,
    applySolution,
    runBench,
    importLabPayload: importLabPayloadHandler,
    exportLabPayload,
  };
}
