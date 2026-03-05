import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BenchmarkRunRecord } from '../../ports/benchmarkPort';

type ButtonElement = ReactElement<{ children?: ReactNode; onClick?: () => void }>;

function collectButtons(node: unknown, buttons: ButtonElement[] = []): ButtonElement[] {
  if (!node) {
    return buttons;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectButtons(child, buttons));
    return buttons;
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return buttons;
  }
  if (node.type === 'button') {
    buttons.push(node as ButtonElement);
  }
  collectButtons(node.props?.children, buttons);
  return buttons;
}

function collectText(node: ReactNode, parts: string[] = []): string[] {
  if (typeof node === 'string' || typeof node === 'number') {
    parts.push(String(node));
    return parts;
  }
  if (!node) {
    return parts;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, parts));
    return parts;
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    collectText(node.props?.children, parts);
  }
  return parts;
}

function findButtonByLabel(node: unknown, label: string): ButtonElement | undefined {
  const buttons = collectButtons(node);
  return buttons.find((button) => collectText(button.props.children).join(' ').includes(label));
}

function createResult(overrides: Partial<BenchmarkRunRecord> = {}): BenchmarkRunRecord {
  return {
    id: 'result-1',
    suiteRunId: 'suite-1',
    runId: 'run-1',
    sequence: 1,
    levelId: 'classic-001',
    algorithmId: 'bfsPush',
    repetition: 1,
    options: {
      timeBudgetMs: 1000,
      nodeBudget: 2000,
    },
    status: 'solved',
    metrics: {
      elapsedMs: 10,
      expanded: 3,
      generated: 5,
      maxDepth: 2,
      maxFrontier: 3,
      pushCount: 1,
      moveCount: 2,
    },
    startedAtMs: 100,
    finishedAtMs: 200,
    environment: {
      userAgent: 'vitest',
      hardwareConcurrency: 4,
      appVersion: 'test',
    },
    ...overrides,
  };
}

describe('BenchmarkResultsTable effects', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('react');
  });

  it('toggles direction when clicking the active Completed column header', async () => {
    const setSortKey = vi.fn();
    const setDirection = vi.fn();

    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>();
      let useStateCalls = 0;

      return {
        ...actual,
        useMemo: ((factory: () => unknown) => factory()) as typeof actual.useMemo,
        useState: ((initialValue: unknown) => {
          useStateCalls += 1;
          if (useStateCalls === 1) {
            return ['finishedAtMs', setSortKey];
          }
          return [initialValue, setDirection];
        }) as unknown as typeof actual.useState,
      };
    });

    const { BenchmarkResultsTable } = await import('../BenchmarkResultsTable');
    const element = BenchmarkResultsTable({ results: [createResult()] });
    const completedButton = findButtonByLabel(element, 'Completed');

    expect(completedButton).toBeDefined();
    completedButton?.props.onClick?.();

    expect(setSortKey).toHaveBeenCalledWith('finishedAtMs');
    expect(setDirection).toHaveBeenCalledWith('asc');
  });

  it('sets ascending direction when switching to a different sort key', async () => {
    const setSortKey = vi.fn();
    const setDirection = vi.fn();

    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>();
      let useStateCalls = 0;

      return {
        ...actual,
        useMemo: ((factory: () => unknown) => factory()) as typeof actual.useMemo,
        useState: ((initialValue: unknown) => {
          useStateCalls += 1;
          if (useStateCalls === 1) {
            return ['finishedAtMs', setSortKey];
          }
          return [initialValue, setDirection];
        }) as unknown as typeof actual.useState,
      };
    });

    const { BenchmarkResultsTable } = await import('../BenchmarkResultsTable');
    const element = BenchmarkResultsTable({ results: [createResult()] });
    const levelButton = findButtonByLabel(element, 'Level');

    expect(levelButton).toBeDefined();
    levelButton?.props.onClick?.();

    expect(setSortKey).toHaveBeenCalledWith('levelId');
    expect(setDirection).toHaveBeenCalledWith('asc');
  });
});
