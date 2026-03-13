import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isRouteErrorResponse, Link, useRouteError, useSearchParams } from '@remix-run/react';
import { Provider, useDispatch, useSelector } from 'react-redux';

import {
  BENCHMARK_REPORT_EXPORT_MODEL,
  BENCHMARK_REPORT_TYPE,
  BENCHMARK_REPORT_VERSION,
} from '@corgiban/benchmarks';
import { ALGORITHM_IDS } from '@corgiban/solver';

import { BenchPage } from '../bench/BenchPage';
import { toPublicBenchmarkRunRecords } from '../bench/benchmarkRecord';
import type { BenchmarkComparisonSnapshot } from '../bench/benchmarkAnalytics';
import { exportTextFile, importTextFile } from '../bench/fileAccess.client';
import {
  assertSupportedLevelPackInlineLevels,
  LEVEL_PACK_TYPE,
  LEVEL_PACK_VERSION,
} from '../bench/levelPackImport';
import { RequestedEntryPendingPage } from '../levels/RequestedEntryPending';
import { RequestedEntryUnavailablePage } from '../levels/RequestedEntryUnavailable';
import { isBuiltinLevelId } from '../levels/temporaryLevelCatalog';
import {
  usePlayableLevels,
  useRequestedPlayableEntryResolution,
  useResolvedPlayableEntry,
} from '../levels/usePlayableLevels';
import { buildBenchHref } from '../navigation/handoffLinks';
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
import { getBenchmarkSuiteLevelRefs } from '../ports/benchmarkPort';
import { formatSolverAlgorithmLabel } from '../solver/algorithmLabels';
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
  setSuiteLevelIds,
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

export function BenchRoutePage() {
  const dispatch = useDispatch<AppDispatch>();
  const bench = useSelector((state: RootState) => state.bench);
  const debug = useSelector((state: RootState) => state.settings.debug);
  const [searchParams] = useSearchParams();
  const appliedRequestedLevelSignatureRef = useRef<string | null>(null);
  const playableLevels = usePlayableLevels();
  const requestedPlayableEntry = useResolvedPlayableEntry({
    levelRef: searchParams.get('levelRef'),
    levelId: searchParams.get('levelId'),
    exactLevelKey: searchParams.get('exactLevelKey'),
  });

  useEffect(() => {
    void dispatch(initializeBench());
  }, [dispatch]);

  useEffect(() => {
    return observeBenchPerformance((entries) => {
      dispatch(benchPerfEntriesObserved(entries));
    });
  }, [dispatch]);

  useEffect(() => {
    const requestedLevelId = searchParams.get('levelId');
    const requestedLevelRef = searchParams.get('levelRef');
    const requestedExactLevelKey = searchParams.get('exactLevelKey');
    if (!requestedLevelId && !requestedLevelRef && !requestedExactLevelKey) {
      appliedRequestedLevelSignatureRef.current = null;
      return;
    }

    const requestedLevelSignature = JSON.stringify({
      levelId: requestedLevelId ?? null,
      levelRef: requestedLevelRef ?? null,
      exactLevelKey: requestedExactLevelKey ?? null,
    });
    if (appliedRequestedLevelSignatureRef.current === requestedLevelSignature) {
      return;
    }

    if (!requestedPlayableEntry) {
      return;
    }

    appliedRequestedLevelSignatureRef.current = requestedLevelSignature;
    dispatch(setSuiteLevelIds([requestedPlayableEntry.ref]));
  }, [dispatch, requestedPlayableEntry, searchParams]);

  const availableLevels = playableLevels.map((level) => ({
    id: level.ref,
    name: level.source.kind === 'session' ? `${level.level.name} (session)` : level.level.name,
  }));

  const availableAlgorithms = ALGORITHM_IDS.map((algorithmId) => ({
    id: algorithmId,
    label: formatSolverAlgorithmLabel(algorithmId),
  }));

  const handleExportReport = useCallback(() => {
    const payload = {
      type: BENCHMARK_REPORT_TYPE,
      version: BENCHMARK_REPORT_VERSION,
      exportModel: BENCHMARK_REPORT_EXPORT_MODEL,
      exportedAtIso: new Date().toISOString(),
      results: toPublicBenchmarkRunRecords(bench.results),
    };

    void exportTextFile({
      suggestedName: 'corgiban-benchmark-history.json',
      content: JSON.stringify(payload, null, 2),
    })
      .then(() => {
        dispatch(benchErrorRecorded(null));
        dispatch(benchNoticeRecorded('Benchmark history exported successfully.'));
      })
      .catch((error) => {
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
    const selectedLevelRefs = getBenchmarkSuiteLevelRefs(bench.suite);
    const playableLevelsByRef = new Map(playableLevels.map((level) => [level.ref, level] as const));
    const missingLevelRefs = selectedLevelRefs.filter(
      (levelRef) => !playableLevelsByRef.has(levelRef),
    );

    if (missingLevelRefs.length > 0) {
      dispatch(benchNoticeRecorded(null));
      dispatch(
        benchErrorRecorded(
          `Level pack export could not resolve selected suite entries in the current session: ${missingLevelRefs.join(', ')}.`,
        ),
      );
      return;
    }

    const selectedLevels = selectedLevelRefs.map((levelRef) => playableLevelsByRef.get(levelRef)!);

    try {
      assertSupportedLevelPackInlineLevels(selectedLevels.map((level) => level.level));
    } catch (error) {
      dispatch(benchNoticeRecorded(null));
      dispatch(
        benchErrorRecorded(error instanceof Error ? error.message : 'Failed to export level pack.'),
      );
      return;
    }

    const payload = {
      type: LEVEL_PACK_TYPE,
      version: LEVEL_PACK_VERSION,
      exportedAtIso: new Date().toISOString(),
      levelIds: selectedLevels.map((level) => level.level.id),
      levels: selectedLevels.map((level) => level.level),
    };

    void exportTextFile({
      suggestedName: 'corgiban-level-pack.json',
      content: JSON.stringify(payload, null, 2),
    })
      .then(() => {
        dispatch(benchErrorRecorded(null));
        dispatch(benchNoticeRecorded('Level pack exported successfully.'));
      })
      .catch((error) => {
        dispatch(
          benchErrorRecorded(
            error instanceof Error ? error.message : 'Failed to export level pack.',
          ),
        );
      });
  }, [bench.suite, dispatch, playableLevels]);

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
      })
        .then(() => {
          dispatch(benchErrorRecorded(null));
          dispatch(benchNoticeRecorded('Comparison snapshot exported successfully.'));
        })
        .catch((error) => {
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
  const [searchParams] = useSearchParams();
  const requestedEntryResolution = useRequestedPlayableEntryResolution({
    levelId: searchParams.get('levelId'),
    levelRef: searchParams.get('levelRef'),
    exactLevelKey: searchParams.get('exactLevelKey'),
  });
  const hasUnavailableRequest =
    requestedEntryResolution.status === 'missingExactRef' ||
    requestedEntryResolution.status === 'missingExactKey' ||
    requestedEntryResolution.status === 'missingLevelId';

  useRouteStoreEffect(() => {
    if (hasUnavailableRequest) {
      return () => {
        storeOwner.solverPort.replace(createNoopSolverPort());
        storeOwner.benchmarkPort.replace(createNoopBenchmarkPort());
        storeOwner.persistencePort.replace(createNoopPersistencePort());
      };
    }

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
  }, [hasUnavailableRequest, storeOwner]);

  if (requestedEntryResolution.status === 'pendingClientCatalog') {
    return (
      <RequestedEntryPendingPage
        routeTitle="Benchmark Suite"
        routeSubtitle="Build repeatable suites here. Session-backed handoffs restore after the browser catalog hydrates."
        heading="Restoring suite level"
        message="This Bench handoff depends on browser-session level data that is not available during server render. The route will resume once the client catalog loads."
      />
    );
  }

  if (requestedEntryResolution.status === 'missingExactRef') {
    const fallbackActions =
      requestedEntryResolution.fallbackLevelId &&
      isBuiltinLevelId(requestedEntryResolution.fallbackLevelId)
        ? [
            {
              label: 'Open Built-In Suite',
              to: buildBenchHref({ levelId: requestedEntryResolution.fallbackLevelId }),
            },
          ]
        : [];

    return (
      <RequestedEntryUnavailablePage
        routeTitle="Benchmark Suite"
        routeSubtitle="Build repeatable suites here. Missing handoff targets fail closed instead of silently changing the measured input."
        heading="Requested suite level is unavailable"
        message="The exact session-backed level from this link is no longer available, so Bench will not substitute a different suite input."
        requestedIdentity={requestedEntryResolution.requestedRef}
        actions={[
          ...fallbackActions,
          { label: 'Open Bench', to: '/bench' },
          { label: 'Open Lab', to: '/lab' },
        ]}
      />
    );
  }

  if (requestedEntryResolution.status === 'missingExactKey') {
    const fallbackActions =
      requestedEntryResolution.fallbackLevelId &&
      isBuiltinLevelId(requestedEntryResolution.fallbackLevelId)
        ? [
            {
              label: 'Open Built-In Suite',
              to: buildBenchHref({ levelId: requestedEntryResolution.fallbackLevelId }),
            },
          ]
        : [];

    return (
      <RequestedEntryUnavailablePage
        routeTitle="Benchmark Suite"
        routeSubtitle="Build repeatable suites here. Missing handoff targets fail closed instead of silently changing the measured input."
        heading="Requested level version is unavailable"
        message="The exact playable version from this link is no longer available, so Bench will not substitute a different suite input."
        requestedIdentity={
          requestedEntryResolution.requestedRef ??
          requestedEntryResolution.requestedLevelId ??
          requestedEntryResolution.requestedExactLevelKey
        }
        actions={[
          ...fallbackActions,
          { label: 'Open Bench', to: '/bench' },
          { label: 'Open Lab', to: '/lab' },
        ]}
      />
    );
  }

  if (requestedEntryResolution.status === 'missingLevelId') {
    return (
      <RequestedEntryUnavailablePage
        routeTitle="Benchmark Suite"
        routeSubtitle="Build repeatable suites here. Missing handoff targets fail closed instead of silently changing the measured input."
        heading="Requested suite level is unavailable"
        message="This link requested a level id that is not available in the current playable catalog."
        requestedIdentity={requestedEntryResolution.requestedLevelId}
        actions={[
          { label: 'Open Bench', to: '/bench' },
          { label: 'Open Play', to: '/play' },
          { label: 'Open Lab', to: '/lab' },
        ]}
      />
    );
  }

  return (
    <Provider store={storeOwner.store}>
      <BenchRoutePage />
    </Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const isHttp = isRouteErrorResponse(error);
  const message = isHttp
    ? `${error.status}${error.statusText ? ` ${error.statusText}` : ''}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';

  return (
    <main id="main-content" className="page-shell">
      <h1 className="page-title">Bench</h1>
      <p className="page-subtitle">{message}</p>
      <section className="route-card" aria-label="Recovery navigation">
        <p className="text-sm text-muted">Return to a working page and try again.</p>
        <nav aria-label="Recovery links" className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            className="rounded px-2 py-1 font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            to="/"
          >
            Home
          </Link>
          <Link
            className="rounded px-2 py-1 font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            to="/bench"
          >
            Try Bench again
          </Link>
        </nav>
      </section>
    </main>
  );
}
