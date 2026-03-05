import {
  BENCHMARK_REPORT_EXPORT_MODEL,
  BENCHMARK_REPORT_TYPE,
  BENCHMARK_REPORT_VERSION,
  isBenchmarkRunRecord,
} from '@corgiban/benchmarks';
import { parseLevel } from '@corgiban/core';
import { builtinLevels } from '@corgiban/levels';
import { MAX_IMPORT_BYTES } from '@corgiban/shared';

import { BenchmarkRunCancelledError, type BenchmarkRunRecord } from '../ports/benchmarkPort';
import { formatLevelPackImportNotice, resolveLevelPackImport } from '../bench/levelPackImport';
import type { AppThunk } from './store';
import {
  benchErrorRecorded,
  benchNoticeRecorded,
  benchPersistOutcomeRecorded,
  benchRepositoryHealthRecorded,
  benchResultRecorded,
  benchResultsCleared,
  benchResultsLoaded,
  benchResultsReplaced,
  benchRunCancelRequested,
  benchRunCancelled,
  benchRunCompleted,
  benchRunFailed,
  benchRunProgressUpdated,
  benchRunStarted,
  setSuiteLevelIds,
  type BenchRunStatus,
} from './benchSlice';

const runtimesByLevelId = new Map(
  builtinLevels.map((level) => {
    return [level.id, parseLevel(level)] as const;
  }),
);
const knownLevelIds = new Set(builtinLevels.map((level) => level.id));

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown benchmark error.';
}

function isCancellationError(error: unknown): boolean {
  if (error instanceof BenchmarkRunCancelledError) {
    return true;
  }

  if (
    error &&
    typeof error === 'object' &&
    (error as { code?: unknown }).code === 'BENCHMARK_RUN_CANCELLED'
  ) {
    return true;
  }

  if (error instanceof Error) {
    return error.name === 'BenchmarkRunCancelledError';
  }

  return false;
}

function computeTotalRuns(levelCount: number, algorithmCount: number, repetitions: number): number {
  return levelCount * algorithmCount * repetitions;
}

function isBenchSuiteActive(status: BenchRunStatus): boolean {
  return status === 'running' || status === 'cancelling';
}

function syncPersistenceDiagnostics(
  dispatch: (action: unknown) => void,
  benchmarkStorage: {
    getRepositoryHealth: () => 'durable' | 'memory-fallback' | 'unavailable';
    getLastRepositoryError: () => string | null;
  },
): string | null {
  dispatch(benchRepositoryHealthRecorded(benchmarkStorage.getRepositoryHealth()));
  return benchmarkStorage.getLastRepositoryError();
}

async function reconcilePersistedResults(
  dispatch: (action: unknown) => void,
  benchmarkStorage: {
    loadResults: () => Promise<BenchmarkRunRecord[]>;
    getRepositoryHealth: () => 'durable' | 'memory-fallback' | 'unavailable';
    getLastRepositoryError: () => string | null;
  },
): Promise<string | null> {
  const retainedResults = await benchmarkStorage.loadResults();
  dispatch(benchResultsReplaced(retainedResults));
  return syncPersistenceDiagnostics(dispatch, benchmarkStorage);
}

async function reconcilePersistedResultsSafely(
  dispatch: (action: unknown) => void,
  benchmarkStorage: {
    loadResults: () => Promise<BenchmarkRunRecord[]>;
    getRepositoryHealth: () => 'durable' | 'memory-fallback' | 'unavailable';
    getLastRepositoryError: () => string | null;
  },
): Promise<void> {
  try {
    await reconcilePersistedResults(dispatch, benchmarkStorage);
  } catch {
    syncPersistenceDiagnostics(dispatch, benchmarkStorage);
  }
}

function parseBenchmarkReport(jsonText: string): BenchmarkRunRecord[] {
  const importBytes = new TextEncoder().encode(jsonText).byteLength;
  if (importBytes > MAX_IMPORT_BYTES) {
    const maxMb = (MAX_IMPORT_BYTES / 1024 / 1024).toFixed(1);
    const importMb = (importBytes / 1024 / 1024).toFixed(1);
    throw new Error(`Benchmark report is too large (${importMb} MB). Maximum is ${maxMb} MB.`);
  }

  const parsed = JSON.parse(jsonText) as unknown;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Benchmark report must be a JSON object.');
  }

  const report = parsed as {
    type?: unknown;
    version?: unknown;
    exportModel?: unknown;
    results?: unknown;
  };

  if (report.type !== BENCHMARK_REPORT_TYPE) {
    throw new Error('Unsupported benchmark report type.');
  }

  if (report.version !== BENCHMARK_REPORT_VERSION) {
    throw new Error(`Unsupported benchmark report version. Expected ${BENCHMARK_REPORT_VERSION}.`);
  }

  if (report.exportModel !== BENCHMARK_REPORT_EXPORT_MODEL) {
    throw new Error(
      `Unsupported benchmark report export model. Expected "${BENCHMARK_REPORT_EXPORT_MODEL}".`,
    );
  }

  if (!Array.isArray(report.results)) {
    throw new Error('Benchmark report is missing results.');
  }

  const results = report.results.filter(isBenchmarkRunRecord);
  if (results.length !== report.results.length) {
    throw new Error('Benchmark report contains invalid result entries.');
  }

  return results;
}

function resolveLevelRuntime(levelId: string) {
  const runtime = runtimesByLevelId.get(levelId);
  if (!runtime) {
    throw new Error(`Unknown level id in benchmark suite: ${levelId}`);
  }
  return runtime;
}

export const initializeBench = (): AppThunk<Promise<void>> => {
  return async (dispatch, getState, { benchmarkStorage }) => {
    if (!benchmarkStorage) {
      return;
    }

    try {
      const initResult = await benchmarkStorage.init({ debug: getState().settings.debug });
      dispatch(benchPersistOutcomeRecorded(initResult.persistOutcome));
      dispatch(benchRepositoryHealthRecorded(initResult.repositoryHealth));

      const persistedResults = await benchmarkStorage.loadResults();
      dispatch(benchResultsLoaded(persistedResults));
      dispatch(benchNoticeRecorded(null));
      const repositoryError = syncPersistenceDiagnostics(dispatch, benchmarkStorage);
      dispatch(benchErrorRecorded(repositoryError));
    } catch (error) {
      dispatch(benchErrorRecorded(toErrorMessage(error)));
    }
  };
};

export const runBenchSuite = (): AppThunk<Promise<void>> => {
  return async (dispatch, getState, { benchmarkPort, benchmarkStorage }) => {
    if (!benchmarkPort) {
      return;
    }

    const state = getState();
    const { suite, status } = state.bench;

    if (isBenchSuiteActive(status)) {
      return;
    }

    const totalRuns = computeTotalRuns(
      suite.levelIds.length,
      suite.algorithmIds.length,
      suite.repetitions,
    );

    if (suite.levelIds.length === 0) {
      dispatch(benchErrorRecorded('Select at least one level before running benchmarks.'));
      return;
    }

    if (suite.algorithmIds.length === 0) {
      dispatch(benchErrorRecorded('Select at least one algorithm before running benchmarks.'));
      return;
    }

    if (totalRuns <= 0) {
      dispatch(benchErrorRecorded('Benchmark suite has no executable runs.'));
      return;
    }

    const suiteRunId = crypto.randomUUID();
    const writeTasks: Promise<void>[] = [];
    let hasWriteError = false;
    let repositoryError: string | null = null;
    dispatch(benchRunStarted({ suiteRunId, totalRuns }));

    try {
      await benchmarkPort.runSuite({
        suiteRunId,
        suite,
        levelResolver: resolveLevelRuntime,
        onResult: (result) => {
          dispatch(benchResultRecorded(result));

          if (!benchmarkStorage) {
            return;
          }

          const writeTask = benchmarkStorage.saveResult(result).catch((error) => {
            hasWriteError = true;
            dispatch(benchErrorRecorded(toErrorMessage(error)));
            repositoryError = syncPersistenceDiagnostics(dispatch, benchmarkStorage);
          });
          writeTasks.push(writeTask);
        },
        onProgress: (progress) => {
          dispatch(benchRunProgressUpdated(progress));
        },
      });

      await Promise.all(writeTasks);
      if (benchmarkStorage) {
        const retainedResults = await benchmarkStorage.loadResults();
        dispatch(benchResultsReplaced(retainedResults));
        repositoryError = syncPersistenceDiagnostics(dispatch, benchmarkStorage);
      }
      dispatch(benchRunCompleted({ suiteRunId }));
      if (!hasWriteError) {
        dispatch(benchNoticeRecorded(null));
        dispatch(benchErrorRecorded(repositoryError));
      }
    } catch (error) {
      if (isCancellationError(error)) {
        dispatch(benchRunCancelled({ suiteRunId }));
        return;
      }

      const message = toErrorMessage(error);
      dispatch(benchRunFailed({ suiteRunId, message }));
      dispatch(benchErrorRecorded(message));
    }
  };
};

export const cancelBenchRun = (): AppThunk => {
  return (dispatch, getState, { benchmarkPort }) => {
    const suiteRunId = getState().bench.activeSuiteRunId;
    if (!suiteRunId || !benchmarkPort) {
      return;
    }

    dispatch(benchRunCancelRequested({ suiteRunId }));
    benchmarkPort.cancelSuite(suiteRunId);
  };
};

export const clearBenchResults = (): AppThunk<Promise<void>> => {
  return async (dispatch, getState, { benchmarkStorage }) => {
    const status = getState().bench.status;
    if (isBenchSuiteActive(status)) {
      return;
    }

    try {
      await benchmarkStorage?.clearResults();
      dispatch(benchResultsCleared());
      const repositoryError = benchmarkStorage
        ? syncPersistenceDiagnostics(dispatch, benchmarkStorage)
        : null;
      dispatch(benchNoticeRecorded(null));
      dispatch(benchErrorRecorded(repositoryError));
    } catch (error) {
      if (benchmarkStorage) {
        await reconcilePersistedResultsSafely(dispatch, benchmarkStorage);
      }
      dispatch(benchErrorRecorded(toErrorMessage(error)));
    }
  };
};

export const importBenchmarkReport = (jsonText: string): AppThunk<Promise<void>> => {
  return async (dispatch, getState, { benchmarkStorage }) => {
    const status = getState().bench.status;
    if (isBenchSuiteActive(status)) {
      return;
    }

    let attemptedPersistenceReplace = false;

    try {
      const results = parseBenchmarkReport(jsonText);
      let repositoryError: string | null = null;
      if (benchmarkStorage) {
        attemptedPersistenceReplace = true;
        await benchmarkStorage.replaceResults(results);
        repositoryError = await reconcilePersistedResults(dispatch, benchmarkStorage);
      } else {
        dispatch(benchResultsReplaced(results));
      }
      dispatch(benchNoticeRecorded(null));
      dispatch(benchErrorRecorded(repositoryError));
    } catch (error) {
      if (benchmarkStorage && attemptedPersistenceReplace) {
        await reconcilePersistedResultsSafely(dispatch, benchmarkStorage);
      }
      dispatch(benchErrorRecorded(toErrorMessage(error)));
    }
  };
};

export const importLevelPackSelection = (jsonText: string): AppThunk<Promise<void>> => {
  return async (dispatch, getState) => {
    const status = getState().bench.status;
    if (isBenchSuiteActive(status)) {
      return;
    }

    try {
      const summary = resolveLevelPackImport(jsonText, knownLevelIds);
      const { validLevelIds } = summary;

      if (validLevelIds.length === 0) {
        throw new Error('No known built-in level ids were found in the imported level pack.');
      }

      dispatch(setSuiteLevelIds(validLevelIds));
      dispatch(benchErrorRecorded(null));
      dispatch(benchNoticeRecorded(formatLevelPackImportNotice(summary)));
    } catch (error) {
      dispatch(benchNoticeRecorded(null));
      dispatch(benchErrorRecorded(toErrorMessage(error)));
    }
  };
};
