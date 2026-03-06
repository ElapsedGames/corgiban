import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { isRouteErrorResponse, useRouteError } from '@remix-run/react';
import { Provider, useDispatch, useSelector } from 'react-redux';

import {
  BENCHMARK_REPORT_EXPORT_MODEL,
  BENCHMARK_REPORT_TYPE,
  BENCHMARK_REPORT_VERSION,
} from '@corgiban/benchmarks';
import { builtinLevels } from '@corgiban/levels';
import { ALGORITHM_IDS, isImplementedAlgorithmId } from '@corgiban/solver';

import { BenchPage } from '../bench/BenchPage';
import type { BenchmarkComparisonSnapshot } from '../bench/benchmarkAnalytics';
import { exportTextFile, importTextFile } from '../bench/fileAccess.client';
import { LEVEL_PACK_TYPE, LEVEL_PACK_VERSION } from '../bench/levelPackImport';
import {
  clearBenchPerformanceEntries,
  observeBenchPerformance,
} from '../bench/performanceObserver.client';
import { createNoopBenchmarkPort } from '../ports/benchmarkPort';
import { createBenchmarkPort } from '../ports/benchmarkPort.client';
import { createNoopPersistencePort } from '../ports/persistencePort';
import { createPersistencePort } from '../ports/persistencePort.client';
import { createNoopSolverPort } from '../ports/solverPort';
import { createSolverPort } from '../ports/solverPort.client';
import type { AppDispatch, AppStore, RootState } from '../state';
import {
  benchErrorRecorded,
  benchNoticeRecorded,
  benchPerfEntriesCleared,
  benchPerfEntriesObserved,
  clearBenchResults,
  createAppStore,
  importBenchmarkReport,
  importLevelPackSelection,
  initializeBench,
  runBenchSuite,
  cancelBenchRun,
  setSuiteNodeBudget,
  setSuiteRepetitions,
  setSuiteWarmupRepetitions,
  setSuiteTimeBudgetMs,
  toggleSuiteAlgorithmId,
  toggleSuiteLevelId,
} from '../state';
import {
  createMutableBenchmarkPort,
  createMutablePersistencePort,
  createMutableSolverPort,
  type MutableBenchmarkPort,
  type MutablePersistencePort,
  type MutableSolverPort,
} from '../state/mutableDependencies';

const useRouteStoreEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

type BenchRouteStoreOwner = {
  solverPort: MutableSolverPort;
  benchmarkPort: MutableBenchmarkPort;
  persistencePort: MutablePersistencePort;
  store: AppStore;
};

function createBenchRouteStoreOwner(): BenchRouteStoreOwner {
  const solverPort = createMutableSolverPort();
  const benchmarkPort = createMutableBenchmarkPort();
  const persistencePort = createMutablePersistencePort();

  return {
    solverPort,
    benchmarkPort,
    persistencePort,
    store: createAppStore({
      solverPort,
      benchmarkPort,
      persistencePort,
    }),
  };
}

function BenchRoutePage() {
  const dispatch = useDispatch<AppDispatch>();
  const bench = useSelector((state: RootState) => state.bench);
  const debug = useSelector((state: RootState) => state.settings.debug);

  useEffect(() => {
    void dispatch(initializeBench());
  }, [dispatch]);

  useEffect(() => {
    return observeBenchPerformance((entries) => {
      dispatch(benchPerfEntriesObserved(entries));
    });
  }, [dispatch]);

  const availableLevels = useMemo(
    () => builtinLevels.map((level) => ({ id: level.id, name: level.name })),
    [],
  );

  const availableAlgorithms = useMemo(
    () =>
      ALGORITHM_IDS.map((algorithmId) => ({
        id: algorithmId,
        label: isImplementedAlgorithmId(algorithmId) ? algorithmId : `${algorithmId} (coming soon)`,
        disabled: !isImplementedAlgorithmId(algorithmId),
      })),
    [],
  );

  const handleExportReport = useCallback(() => {
    const payload = {
      type: BENCHMARK_REPORT_TYPE,
      version: BENCHMARK_REPORT_VERSION,
      exportModel: BENCHMARK_REPORT_EXPORT_MODEL,
      exportedAtIso: new Date().toISOString(),
      results: bench.results,
    };

    void exportTextFile({
      suggestedName: 'corgiban-benchmark-history.json',
      content: JSON.stringify(payload, null, 2),
    }).catch((error) => {
      dispatch(
        benchErrorRecorded(error instanceof Error ? error.message : 'Failed to export report.'),
      );
    });
  }, [bench.results, dispatch]);

  const handleImportReport = useCallback(() => {
    void importTextFile({ acceptMimeTypes: ['application/json'] })
      .then((result) => {
        return dispatch(importBenchmarkReport(result.content));
      })
      .catch((error) => {
        dispatch(
          benchErrorRecorded(error instanceof Error ? error.message : 'Failed to import report.'),
        );
      });
  }, [dispatch]);

  const handleExportLevelPack = useCallback(() => {
    const selectedLevels = builtinLevels.filter((level) => bench.suite.levelIds.includes(level.id));
    const payload = {
      type: LEVEL_PACK_TYPE,
      version: LEVEL_PACK_VERSION,
      exportedAtIso: new Date().toISOString(),
      levelIds: selectedLevels.map((level) => level.id),
      levels: selectedLevels,
    };

    void exportTextFile({
      suggestedName: 'corgiban-level-pack.json',
      content: JSON.stringify(payload, null, 2),
    }).catch((error) => {
      dispatch(
        benchErrorRecorded(error instanceof Error ? error.message : 'Failed to export level pack.'),
      );
    });
  }, [bench.suite.levelIds, dispatch]);

  const handleImportLevelPack = useCallback(() => {
    void importTextFile({ acceptMimeTypes: ['application/json'] })
      .then((result) => {
        return dispatch(importLevelPackSelection(result.content));
      })
      .catch((error) => {
        dispatch(benchNoticeRecorded(null));
        dispatch(
          benchErrorRecorded(
            error instanceof Error ? error.message : 'Failed to import level pack.',
          ),
        );
      });
  }, [dispatch]);

  const handleExportComparisonSnapshot = useCallback(
    (snapshot: BenchmarkComparisonSnapshot) => {
      void exportTextFile({
        suggestedName: 'corgiban-benchmark-comparison.json',
        content: JSON.stringify(snapshot, null, 2),
      }).catch((error) => {
        dispatch(
          benchErrorRecorded(
            error instanceof Error ? error.message : 'Failed to export comparison snapshot.',
          ),
        );
      });
    },
    [dispatch],
  );

  return (
    <BenchPage
      suite={bench.suite}
      status={bench.status}
      progress={bench.progress}
      results={bench.results}
      diagnostics={bench.diagnostics}
      perfEntries={bench.perfEntries}
      debug={debug}
      availableLevels={availableLevels}
      availableAlgorithms={availableAlgorithms}
      onToggleLevel={(levelId) => {
        dispatch(toggleSuiteLevelId(levelId));
      }}
      onToggleAlgorithm={(algorithmId) => {
        dispatch(toggleSuiteAlgorithmId(algorithmId));
      }}
      onSetRepetitions={(value) => {
        dispatch(setSuiteRepetitions(value));
      }}
      onSetWarmupRepetitions={(value) => {
        dispatch(setSuiteWarmupRepetitions(value));
      }}
      onSetTimeBudgetMs={(value) => {
        dispatch(setSuiteTimeBudgetMs(value));
      }}
      onSetNodeBudget={(value) => {
        dispatch(setSuiteNodeBudget(value));
      }}
      onRun={() => {
        void dispatch(runBenchSuite());
      }}
      onCancel={() => {
        dispatch(cancelBenchRun());
      }}
      onClearPerfEntries={() => {
        clearBenchPerformanceEntries();
        dispatch(benchPerfEntriesCleared());
      }}
      onExportReport={handleExportReport}
      onImportReport={handleImportReport}
      onExportLevelPack={handleExportLevelPack}
      onImportLevelPack={handleImportLevelPack}
      onClearResults={() => {
        void dispatch(clearBenchResults());
      }}
      onExportComparisonSnapshot={handleExportComparisonSnapshot}
    />
  );
}

export default function BenchRoute() {
  const [storeOwner] = useState(createBenchRouteStoreOwner);

  useRouteStoreEffect(() => {
    if (typeof document !== 'undefined') {
      storeOwner.solverPort.replace(createSolverPort());
      storeOwner.benchmarkPort.replace(createBenchmarkPort());
      storeOwner.persistencePort.replace(createPersistencePort());
    }

    return () => {
      storeOwner.solverPort.replace(createNoopSolverPort());
      storeOwner.benchmarkPort.replace(createNoopBenchmarkPort());
      storeOwner.persistencePort.replace(createNoopPersistencePort());
    };
  }, [storeOwner]);

  return (
    <Provider store={storeOwner.store}>
      <BenchRoutePage />
    </Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main className="page-shell">
        <h1 className="page-title">Bench</h1>
        <p className="page-subtitle">
          {error.status} {error.statusText}
        </p>
      </main>
    );
  }

  const message = error instanceof Error ? error.message : 'Unknown error';

  return (
    <main className="page-shell">
      <h1 className="page-title">Bench</h1>
      <p className="page-subtitle">{message}</p>
    </main>
  );
}
