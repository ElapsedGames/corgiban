import { createSlice } from '@reduxjs/toolkit';

import { builtinLevels } from '@corgiban/levels';
import {
  DEFAULT_ALGORITHM_ID,
  DEFAULT_NODE_BUDGET,
  DEFAULT_SOLVER_TIME_BUDGET_MS,
} from '@corgiban/solver';

import type { PersistOutcome, RepositoryHealth } from '../ports/persistencePort';
import { toBuiltinLevelRef } from '../levels/temporaryLevelCatalog';
import type { BenchmarkRunRecord, BenchmarkSuiteConfig } from '../ports/benchmarkPort';

export type BenchRunStatus =
  | 'idle'
  | 'running'
  | 'cancelling'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type BenchProgressState = {
  totalRuns: number;
  completedRuns: number;
  latestResultId: string | null;
};

export type BenchPerfEntry = {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
};

export type BenchDiagnosticsState = {
  persistOutcome: PersistOutcome | null;
  repositoryHealth: RepositoryHealth | null;
  lastError: string | null;
  lastNotice: string | null;
};

export type BenchSliceState = {
  suite: BenchmarkSuiteConfig;
  status: BenchRunStatus;
  activeSuiteRunId: string | null;
  progress: BenchProgressState;
  results: BenchmarkRunRecord[];
  resultIdLookup: Record<string, true>;
  diagnostics: BenchDiagnosticsState;
  perfEntries: BenchPerfEntry[];
};

const MAX_PERF_ENTRIES = 250;

function toPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function compareByCompletion(left: BenchmarkRunRecord, right: BenchmarkRunRecord): number {
  if (left.finishedAtMs !== right.finishedAtMs) {
    return left.finishedAtMs - right.finishedAtMs;
  }

  if (left.startedAtMs !== right.startedAtMs) {
    return left.startedAtMs - right.startedAtMs;
  }

  return left.id.localeCompare(right.id);
}

function mergeResults(results: BenchmarkRunRecord[]): BenchmarkRunRecord[] {
  const byId = new Map<string, BenchmarkRunRecord>();

  results.forEach((result) => {
    byId.set(result.id, result);
  });

  return [...byId.values()].sort(compareByCompletion);
}

function buildResultLookup(results: BenchmarkRunRecord[]): Record<string, true> {
  const lookup: Record<string, true> = {};
  results.forEach((result) => {
    lookup[result.id] = true;
  });
  return lookup;
}

function isActiveBenchStatus(status: BenchRunStatus): boolean {
  return status === 'running' || status === 'cancelling';
}

const defaultLevelRefs = builtinLevels.slice(0, 3).map((level) => toBuiltinLevelRef(level.id));

const initialState: BenchSliceState = {
  suite: {
    levelRefs: defaultLevelRefs,
    levelIds: defaultLevelRefs,
    algorithmIds: [DEFAULT_ALGORITHM_ID],
    repetitions: 1,
    warmupRepetitions: 0,
    timeBudgetMs: DEFAULT_SOLVER_TIME_BUDGET_MS,
    nodeBudget: DEFAULT_NODE_BUDGET,
  },
  status: 'idle',
  activeSuiteRunId: null,
  progress: {
    totalRuns: 0,
    completedRuns: 0,
    latestResultId: null,
  },
  results: [],
  resultIdLookup: {},
  diagnostics: {
    persistOutcome: null,
    repositoryHealth: null,
    lastError: null,
    lastNotice: null,
  },
  perfEntries: [],
};

export const benchSlice = createSlice({
  name: 'bench',
  initialState,
  reducers: {
    setSuiteLevelIds(state, action: { payload: string[] }) {
      const nextLevelRefs = uniqueStrings(action.payload);
      state.suite.levelRefs = nextLevelRefs;
      state.suite.levelIds = nextLevelRefs;
    },
    toggleSuiteLevelId(state, action: { payload: string }) {
      const levelRef = action.payload;
      const levelRefs = state.suite.levelRefs ?? state.suite.levelIds ?? [];
      const hasLevel = levelRefs.includes(levelRef);
      const nextLevelRefs = hasLevel
        ? levelRefs.filter((entry) => entry !== levelRef)
        : [...levelRefs, levelRef];
      state.suite.levelRefs = nextLevelRefs;
      state.suite.levelIds = nextLevelRefs;
    },
    setSuiteAlgorithmIds(state, action: { payload: BenchmarkSuiteConfig['algorithmIds'] }) {
      state.suite.algorithmIds = uniqueStrings(
        action.payload,
      ) as BenchmarkSuiteConfig['algorithmIds'];
    },
    toggleSuiteAlgorithmId(
      state,
      action: { payload: BenchmarkSuiteConfig['algorithmIds'][number] },
    ) {
      const algorithmId = action.payload;
      const hasAlgorithm = state.suite.algorithmIds.includes(algorithmId);
      state.suite.algorithmIds = hasAlgorithm
        ? state.suite.algorithmIds.filter((entry) => entry !== algorithmId)
        : [...state.suite.algorithmIds, algorithmId];
    },
    setSuiteRepetitions(state, action: { payload: number }) {
      state.suite.repetitions = toPositiveInt(action.payload, state.suite.repetitions);
    },
    setSuiteWarmupRepetitions(state, action: { payload: number }) {
      if (!Number.isFinite(action.payload) || action.payload < 0) {
        return;
      }

      state.suite.warmupRepetitions = Math.floor(action.payload);
    },
    setSuiteTimeBudgetMs(state, action: { payload: number }) {
      state.suite.timeBudgetMs = toPositiveInt(action.payload, state.suite.timeBudgetMs);
    },
    setSuiteNodeBudget(state, action: { payload: number }) {
      state.suite.nodeBudget = toPositiveInt(action.payload, state.suite.nodeBudget);
    },
    benchRunStarted(state, action: { payload: { suiteRunId: string; totalRuns: number } }) {
      state.status = 'running';
      state.activeSuiteRunId = action.payload.suiteRunId;
      state.progress = {
        totalRuns: action.payload.totalRuns,
        completedRuns: 0,
        latestResultId: null,
      };
      state.diagnostics.lastError = null;
      state.diagnostics.lastNotice = null;
    },
    benchRunProgressUpdated(
      state,
      action: {
        payload: {
          suiteRunId: string;
          totalRuns: number;
          completedRuns: number;
          latestResultId?: string;
        };
      },
    ) {
      if (state.activeSuiteRunId !== action.payload.suiteRunId) {
        return;
      }

      state.progress.totalRuns = action.payload.totalRuns;
      state.progress.completedRuns = action.payload.completedRuns;
      state.progress.latestResultId = action.payload.latestResultId ?? null;
    },
    benchResultRecorded(state, action: { payload: BenchmarkRunRecord }) {
      if (state.resultIdLookup[action.payload.id]) {
        return;
      }

      state.results.push(action.payload);
      state.resultIdLookup[action.payload.id] = true;
    },
    benchRunCancelRequested(state, action: { payload: { suiteRunId: string } }) {
      if (state.activeSuiteRunId !== action.payload.suiteRunId) {
        return;
      }

      state.status = 'cancelling';
    },
    benchRunCancelled(state, action: { payload: { suiteRunId: string } }) {
      if (state.activeSuiteRunId !== action.payload.suiteRunId) {
        return;
      }

      state.status = 'cancelled';
      state.activeSuiteRunId = null;
    },
    benchRunCompleted(state, action: { payload: { suiteRunId: string } }) {
      if (state.activeSuiteRunId !== action.payload.suiteRunId) {
        return;
      }

      state.status = 'completed';
      state.activeSuiteRunId = null;
    },
    benchRunFailed(state, action: { payload: { suiteRunId: string; message: string } }) {
      if (state.activeSuiteRunId !== action.payload.suiteRunId) {
        return;
      }

      state.status = 'failed';
      state.activeSuiteRunId = null;
      state.diagnostics.lastError = action.payload.message;
    },
    benchResultsLoaded(state, action: { payload: BenchmarkRunRecord[] }) {
      state.results = mergeResults(action.payload);
      state.resultIdLookup = buildResultLookup(state.results);
    },
    benchResultsReplaced(state, action: { payload: BenchmarkRunRecord[] }) {
      state.results = mergeResults(action.payload);
      state.resultIdLookup = buildResultLookup(state.results);
    },
    benchResultsCleared(state) {
      if (isActiveBenchStatus(state.status)) {
        return;
      }

      state.results = [];
      state.resultIdLookup = {};
      state.progress.latestResultId = null;
      state.progress.completedRuns = 0;
      state.progress.totalRuns = 0;
    },
    benchPersistOutcomeRecorded(state, action: { payload: PersistOutcome }) {
      state.diagnostics.persistOutcome = action.payload;
    },
    benchRepositoryHealthRecorded(state, action: { payload: RepositoryHealth }) {
      state.diagnostics.repositoryHealth = action.payload;
    },
    benchErrorRecorded(state, action: { payload: string | null }) {
      state.diagnostics.lastError = action.payload;
      if (action.payload) {
        state.diagnostics.lastNotice = null;
      }
    },
    benchNoticeRecorded(state, action: { payload: string | null }) {
      state.diagnostics.lastNotice = action.payload;
    },
    benchPerfEntriesObserved(state, action: { payload: BenchPerfEntry[] }) {
      state.perfEntries = [...state.perfEntries, ...action.payload].slice(-MAX_PERF_ENTRIES);
    },
    benchPerfEntriesCleared(state) {
      state.perfEntries = [];
    },
  },
});

export const {
  benchErrorRecorded,
  benchNoticeRecorded,
  benchPerfEntriesCleared,
  benchPerfEntriesObserved,
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
  setSuiteAlgorithmIds,
  setSuiteLevelIds,
  setSuiteNodeBudget,
  setSuiteRepetitions,
  setSuiteWarmupRepetitions,
  setSuiteTimeBudgetMs,
  toggleSuiteAlgorithmId,
  toggleSuiteLevelId,
} = benchSlice.actions;
