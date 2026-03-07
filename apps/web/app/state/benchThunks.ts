import { buildSuiteComparisonInfo, parseBenchmarkReportJson } from '@corgiban/benchmarks';
import { parseLevel } from '@corgiban/core';
import { builtinLevels } from '@corgiban/levels';

import { BenchmarkRunCancelledError, type BenchmarkRunRecord } from '../ports/benchmarkPort';
import type { PersistencePort } from '../ports/persistencePort';
import { formatLevelPackImportNotice, resolveLevelPackImport } from '../bench/levelPackImport';
import { makeRunId } from '../runId';
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
  persistencePort: Pick<PersistencePort, 'getRepositoryHealth' | 'getLastRepositoryError'>,
): string | null {
  dispatch(benchRepositoryHealthRecorded(persistencePort.getRepositoryHealth()));
  return persistencePort.getLastRepositoryError();
}

async function reconcilePersistedResults(
  dispatch: (action: unknown) => void,
  persistencePort: Pick<
    PersistencePort,
    'loadResults' | 'getRepositoryHealth' | 'getLastRepositoryError'
  >,
): Promise<string | null> {
  const retainedResults = await persistencePort.loadResults();
  dispatch(benchResultsReplaced(retainedResults));
  return syncPersistenceDiagnostics(dispatch, persistencePort);
}

async function reconcilePersistedResultsSafely(
  dispatch: (action: unknown) => void,
  persistencePort: Pick<
    PersistencePort,
    'loadResults' | 'getRepositoryHealth' | 'getLastRepositoryError'
  >,
): Promise<void> {
  try {
    await reconcilePersistedResults(dispatch, persistencePort);
  } catch {
    syncPersistenceDiagnostics(dispatch, persistencePort);
  }
}

function resolveLevelRuntime(levelId: string) {
  const runtime = runtimesByLevelId.get(levelId);
  if (!runtime) {
    throw new Error(`Unknown level id in benchmark suite: ${levelId}`);
  }
  return runtime;
}

function formatImportedComparisonNotice(results: BenchmarkRunRecord[]): string | null {
  const recordsBySuite = new Map<string, BenchmarkRunRecord[]>();

  results.forEach((result) => {
    const suiteResults = recordsBySuite.get(result.suiteRunId) ?? [];
    suiteResults.push(result);
    recordsBySuite.set(result.suiteRunId, suiteResults);
  });

  const degradedSuites = [...recordsBySuite.entries()]
    .map(([suiteRunId, suiteResults]) => {
      return {
        suiteRunId,
        issues: buildSuiteComparisonInfo(suiteResults).issues,
      };
    })
    .filter((suite) => suite.issues.length > 0);

  if (degradedSuites.length === 0) {
    return null;
  }

  const affectedRuns = degradedSuites.reduce((total, suite) => total + suite.issues.length, 0);
  const listedSuites = degradedSuites
    .slice(0, 3)
    .map((suite) => suite.suiteRunId)
    .join(', ');
  const remainingSuites = degradedSuites.length > 3 ? `, +${degradedSuites.length - 3} more` : '';
  const suiteNoun = degradedSuites.length === 1 ? 'suite' : 'suites';
  const runNoun = affectedRuns === 1 ? 'run' : 'runs';

  return `Imported report includes ${affectedRuns} ${runNoun} without comparable metadata across ${degradedSuites.length} ${suiteNoun}. Analytics will mark those suites as non-comparable. Affected suites: ${listedSuites}${remainingSuites}.`;
}

function splitImportedWarmupResults(results: BenchmarkRunRecord[]): {
  measuredResults: BenchmarkRunRecord[];
  discardedWarmupCount: number;
  discardedWarmupSuiteIds: string[];
} {
  const measuredResults: BenchmarkRunRecord[] = [];
  const discardedWarmupSuiteIds = new Set<string>();
  let discardedWarmupCount = 0;

  results.forEach((result) => {
    if (result.warmup === true) {
      discardedWarmupCount += 1;
      discardedWarmupSuiteIds.add(result.suiteRunId);
      return;
    }

    measuredResults.push(result);
  });

  return {
    measuredResults,
    discardedWarmupCount,
    discardedWarmupSuiteIds: [...discardedWarmupSuiteIds].sort(),
  };
}

function formatImportedWarmupNotice(
  discardedWarmupCount: number,
  discardedWarmupSuiteIds: string[],
): string | null {
  if (discardedWarmupCount === 0) {
    return null;
  }

  const listedSuites = discardedWarmupSuiteIds.slice(0, 3).join(', ');
  const remainingSuites =
    discardedWarmupSuiteIds.length > 3 ? `, +${discardedWarmupSuiteIds.length - 3} more` : '';
  const runNoun = discardedWarmupCount === 1 ? 'run' : 'runs';
  const suiteNoun = discardedWarmupSuiteIds.length === 1 ? 'suite' : 'suites';

  return `Imported report skipped ${discardedWarmupCount} warm-up ${runNoun} across ${discardedWarmupSuiteIds.length} ${suiteNoun}. Warm-up runs are excluded from measured benchmark history. Affected suites: ${listedSuites}${remainingSuites}.`;
}

function joinImportNotices(notices: Array<string | null>): string | null {
  const nonEmptyNotices = notices.filter((notice): notice is string => notice !== null);
  return nonEmptyNotices.length > 0 ? nonEmptyNotices.join(' ') : null;
}

export const initializeBench = (): AppThunk<Promise<void>> => {
  return async (dispatch, getState, { persistencePort }) => {
    if (!persistencePort) {
      return;
    }

    try {
      const initResult = await persistencePort.init({ debug: getState().settings.debug });
      dispatch(benchPersistOutcomeRecorded(initResult.persistOutcome));
      dispatch(benchRepositoryHealthRecorded(initResult.repositoryHealth));

      const persistedResults = await persistencePort.loadResults();
      dispatch(benchResultsLoaded(persistedResults));
      dispatch(benchNoticeRecorded(null));
      const repositoryError = syncPersistenceDiagnostics(dispatch, persistencePort);
      dispatch(benchErrorRecorded(repositoryError));
    } catch (error) {
      dispatch(benchErrorRecorded(toErrorMessage(error)));
    }
  };
};

export const runBenchSuite = (): AppThunk<Promise<void>> => {
  return async (dispatch, getState, { benchmarkPort, persistencePort }) => {
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

    const suiteRunId = makeRunId('bench-suite');
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

          if (!persistencePort) {
            return;
          }

          const writeTask = persistencePort.saveResult(result).catch((error) => {
            hasWriteError = true;
            dispatch(benchErrorRecorded(toErrorMessage(error)));
            repositoryError = syncPersistenceDiagnostics(dispatch, persistencePort);
          });
          writeTasks.push(writeTask);
        },
        onProgress: (progress) => {
          dispatch(benchRunProgressUpdated(progress));
        },
      });

      await Promise.all(writeTasks);
      if (persistencePort) {
        const retainedResults = await persistencePort.loadResults();
        dispatch(benchResultsReplaced(retainedResults));
        repositoryError = syncPersistenceDiagnostics(dispatch, persistencePort);
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
  return async (dispatch, getState, { persistencePort }) => {
    const status = getState().bench.status;
    if (isBenchSuiteActive(status)) {
      return;
    }

    try {
      await persistencePort?.clearResults();
      dispatch(benchResultsCleared());
      const repositoryError = persistencePort
        ? syncPersistenceDiagnostics(dispatch, persistencePort)
        : null;
      dispatch(benchNoticeRecorded(null));
      dispatch(benchErrorRecorded(repositoryError));
    } catch (error) {
      if (persistencePort) {
        await reconcilePersistedResultsSafely(dispatch, persistencePort);
      }
      dispatch(benchErrorRecorded(toErrorMessage(error)));
    }
  };
};

export const importBenchmarkReport = (jsonText: string): AppThunk<Promise<void>> => {
  return async (dispatch, getState, { persistencePort }) => {
    const status = getState().bench.status;
    if (isBenchSuiteActive(status)) {
      return;
    }

    let attemptedPersistenceReplace = false;

    try {
      const parsedResults = parseBenchmarkReportJson(jsonText);
      const { measuredResults, discardedWarmupCount, discardedWarmupSuiteIds } =
        splitImportedWarmupResults(parsedResults);
      const importNotice = joinImportNotices([
        formatImportedWarmupNotice(discardedWarmupCount, discardedWarmupSuiteIds),
        formatImportedComparisonNotice(measuredResults),
      ]);
      let repositoryError: string | null = null;
      if (persistencePort) {
        attemptedPersistenceReplace = true;
        await persistencePort.replaceResults(measuredResults);
        repositoryError = await reconcilePersistedResults(dispatch, persistencePort);
      } else {
        dispatch(benchResultsReplaced(measuredResults));
      }
      dispatch(benchNoticeRecorded(importNotice));
      dispatch(benchErrorRecorded(repositoryError));
    } catch (error) {
      if (persistencePort && attemptedPersistenceReplace) {
        await reconcilePersistedResultsSafely(dispatch, persistencePort);
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
