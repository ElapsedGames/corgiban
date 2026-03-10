import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { isValidElement } from 'react';

import { BenchPage } from '../BenchPage';
import { BenchmarkAnalyticsPanel } from '../BenchmarkAnalyticsPanel';
import type { BenchmarkRunRecord } from '../../ports/benchmarkPort';
import type { BenchmarkComparisonSnapshot } from '../benchmarkAnalytics';

function findByType(node: unknown, targetType: unknown): ReactElement | undefined {
  if (!node) {
    return undefined;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findByType(child, targetType);
      if (match) {
        return match;
      }
    }
    return undefined;
  }
  if (!isValidElement<{ children?: unknown }>(node)) {
    return undefined;
  }
  if (node.type === targetType) {
    return node;
  }
  return findByType(node.props?.children, targetType);
}

function createResult(overrides: Partial<BenchmarkRunRecord> = {}): BenchmarkRunRecord {
  return {
    id: 'result-1',
    suiteRunId: 'bench-1',
    runId: 'bench-1-1',
    sequence: 1,
    levelId: 'corgiban-test-18',
    algorithmId: 'bfsPush',
    repetition: 1,
    options: {
      timeBudgetMs: 1_000,
      nodeBudget: 500,
    },
    status: 'unsolved',
    metrics: {
      elapsedMs: 10,
      expanded: 2,
      generated: 3,
      maxDepth: 1,
      maxFrontier: 2,
      pushCount: 1,
      moveCount: 2,
    },
    startedAtMs: 10,
    finishedAtMs: 20,
    environment: {
      userAgent: 'test',
      hardwareConcurrency: 4,
      appVersion: 'test',
    },
    ...overrides,
  };
}

const noop = () => undefined;

const baseProps = {
  suite: {
    levelIds: ['corgiban-test-18'],
    algorithmIds: ['bfsPush' as const],
    repetitions: 1,
    timeBudgetMs: 1_000,
    nodeBudget: 500,
  },
  status: 'idle' as const,
  progress: {
    totalRuns: 0,
    completedRuns: 0,
    latestResultId: null,
  },
  results: [createResult()],
  diagnostics: {
    persistOutcome: 'granted' as const,
    repositoryHealth: 'durable' as const,
    lastError: null,
    lastNotice: null,
  },
  perfEntries: [],
  debug: false,
  availableLevels: [{ id: 'corgiban-test-18', name: 'Classic 001' }],
  availableAlgorithms: [{ id: 'bfsPush' as const, label: 'bfsPush' }],
  onToggleLevel: noop,
  onToggleAlgorithm: noop,
  onSetRepetitions: noop,
  onSetTimeBudgetMs: noop,
  onSetNodeBudget: noop,
  onRun: noop,
  onCancel: noop,
  onClearPerfEntries: noop,
  onExportReport: noop,
  onImportReport: noop,
  onExportLevelPack: noop,
  onImportLevelPack: noop,
  onClearResults: noop,
};

describe('BenchPage branch coverage', () => {
  it('passes the comparison snapshot export handler through to analytics', () => {
    const onExportComparisonSnapshot = vi.fn();
    const snapshot = {
      id: 'snapshot-1',
    } as unknown as BenchmarkComparisonSnapshot;

    const element = BenchPage({
      ...baseProps,
      onExportComparisonSnapshot,
    });

    const analytics = findByType(element, BenchmarkAnalyticsPanel);
    expect(analytics).toBeDefined();

    analytics?.props.onExportSnapshot(snapshot);

    expect(onExportComparisonSnapshot).toHaveBeenCalledTimes(1);
    expect(onExportComparisonSnapshot).toHaveBeenCalledWith(snapshot);
  });
});
