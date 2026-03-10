// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import type { BenchmarkRunRecord } from '../../ports/benchmarkPort';
import { BenchmarkResultsTable } from '../BenchmarkResultsTable';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

function createResult(overrides: Partial<BenchmarkRunRecord> = {}): BenchmarkRunRecord {
  return {
    id: 'result-1',
    suiteRunId: 'suite-1',
    runId: 'run-1',
    sequence: 1,
    levelId: 'corgiban-test-18',
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

const mountedRoots: Root[] = [];

async function renderTable(results: BenchmarkRunRecord[]) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<BenchmarkResultsTable results={results} />);
  });

  return { container };
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes(label),
    ) ?? null
  );
}

function getRenderedLevelOrder(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-testid="benchmark-result-level"]')].map(
    (cell) => cell.textContent ?? '',
  );
}

function expectRenderedLevelOrder(container: HTMLElement, expectedLevelIds: string[]) {
  expect(getRenderedLevelOrder(container)).toEqual(expectedLevelIds);
}

afterEach(async () => {
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop();
    await act(async () => {
      root?.unmount();
    });
  }

  document.body.innerHTML = '';
});

describe('BenchmarkResultsTable interactions', () => {
  it('toggles the Completed sort direction and re-renders rows in ascending order', async () => {
    const oldest = createResult({
      id: 'oldest',
      levelId: 'level-oldest',
      finishedAtMs: 1_000,
      startedAtMs: 900,
    });
    const middle = createResult({
      id: 'middle',
      levelId: 'level-middle',
      finishedAtMs: 2_000,
      startedAtMs: 1_900,
    });
    const newest = createResult({
      id: 'newest',
      levelId: 'level-newest',
      finishedAtMs: 3_000,
      startedAtMs: 2_900,
    });

    const { container } = await renderTable([oldest, newest, middle]);

    expectRenderedLevelOrder(container, ['level-newest', 'level-middle', 'level-oldest']);

    await act(async () => {
      findButton(container, 'Completed')?.click();
    });

    expectRenderedLevelOrder(container, ['level-oldest', 'level-middle', 'level-newest']);
  });

  it('switches to Level sorting and re-renders rows in ascending level order', async () => {
    const zebra = createResult({
      id: 'zebra',
      levelId: 'zebra-level',
      finishedAtMs: 3_000,
      startedAtMs: 2_900,
    });
    const alpha = createResult({
      id: 'alpha',
      levelId: 'alpha-level',
      finishedAtMs: 1_000,
      startedAtMs: 900,
    });
    const middle = createResult({
      id: 'middle',
      levelId: 'middle-level',
      finishedAtMs: 2_000,
      startedAtMs: 1_900,
    });

    const { container } = await renderTable([alpha, zebra, middle]);

    expectRenderedLevelOrder(container, ['zebra-level', 'middle-level', 'alpha-level']);

    await act(async () => {
      findButton(container, 'Level')?.click();
    });

    expectRenderedLevelOrder(container, ['alpha-level', 'middle-level', 'zebra-level']);
  });

  it('switches to Suite sorting and re-renders rows in ascending suite order', async () => {
    const suiteC = createResult({
      id: 'suite-c',
      suiteRunId: 'suite-c',
      levelId: 'level-suite-c',
      finishedAtMs: 3_000,
    });
    const suiteA = createResult({
      id: 'suite-a',
      suiteRunId: 'suite-a',
      levelId: 'level-suite-a',
      finishedAtMs: 1_000,
    });
    const suiteB = createResult({
      id: 'suite-b',
      suiteRunId: 'suite-b',
      levelId: 'level-suite-b',
      finishedAtMs: 2_000,
    });

    const { container } = await renderTable([suiteA, suiteC, suiteB]);

    expectRenderedLevelOrder(container, ['level-suite-c', 'level-suite-b', 'level-suite-a']);

    await act(async () => {
      findButton(container, 'Suite')?.click();
    });

    expectRenderedLevelOrder(container, ['level-suite-a', 'level-suite-b', 'level-suite-c']);
  });

  it('switches to Algorithm sorting and re-renders rows in ascending algorithm order', async () => {
    const ida = createResult({
      id: 'ida',
      algorithmId: 'idaStarPush',
      levelId: 'level-ida',
      finishedAtMs: 3_000,
    });
    const astar = createResult({
      id: 'astar',
      algorithmId: 'astarPush',
      levelId: 'level-astar',
      finishedAtMs: 1_000,
    });
    const bfs = createResult({
      id: 'bfs',
      algorithmId: 'bfsPush',
      levelId: 'level-bfs',
      finishedAtMs: 2_000,
    });

    const { container } = await renderTable([astar, ida, bfs]);

    expectRenderedLevelOrder(container, ['level-ida', 'level-bfs', 'level-astar']);

    await act(async () => {
      findButton(container, 'Algorithm')?.click();
    });

    expectRenderedLevelOrder(container, ['level-astar', 'level-bfs', 'level-ida']);
  });

  it('switches to Elapsed sorting and re-renders rows in ascending elapsed order', async () => {
    const slow = createResult({
      id: 'slow',
      levelId: 'level-slow',
      finishedAtMs: 3_000,
      metrics: { ...createResult().metrics, elapsedMs: 300 },
    });
    const fast = createResult({
      id: 'fast',
      levelId: 'level-fast',
      finishedAtMs: 1_000,
      metrics: { ...createResult().metrics, elapsedMs: 10 },
    });
    const medium = createResult({
      id: 'medium',
      levelId: 'level-medium',
      finishedAtMs: 2_000,
      metrics: { ...createResult().metrics, elapsedMs: 100 },
    });

    const { container } = await renderTable([fast, slow, medium]);

    expectRenderedLevelOrder(container, ['level-slow', 'level-medium', 'level-fast']);

    await act(async () => {
      findButton(container, 'Elapsed (ms)')?.click();
    });

    expectRenderedLevelOrder(container, ['level-fast', 'level-medium', 'level-slow']);
  });

  it('switches to Status sorting and re-renders rows in ascending status order', async () => {
    const timeout = createResult({
      id: 'timeout',
      status: 'timeout',
      levelId: 'level-timeout',
      finishedAtMs: 3_000,
    });
    const solved = createResult({
      id: 'solved',
      status: 'solved',
      levelId: 'level-solved',
      finishedAtMs: 1_000,
    });
    const unsolved = createResult({
      id: 'unsolved',
      status: 'unsolved',
      levelId: 'level-unsolved',
      finishedAtMs: 2_000,
    });

    const { container } = await renderTable([solved, timeout, unsolved]);

    expectRenderedLevelOrder(container, ['level-timeout', 'level-unsolved', 'level-solved']);

    await act(async () => {
      findButton(container, 'Status')?.click();
    });

    expectRenderedLevelOrder(container, ['level-solved', 'level-timeout', 'level-unsolved']);
  });

  it('toggles a non-default sort key back to descending when the same header is clicked twice', async () => {
    const alpha = createResult({
      id: 'alpha',
      levelId: 'alpha-level',
      finishedAtMs: 1_000,
    });
    const middle = createResult({
      id: 'middle',
      levelId: 'middle-level',
      finishedAtMs: 2_000,
    });
    const zebra = createResult({
      id: 'zebra',
      levelId: 'zebra-level',
      finishedAtMs: 3_000,
    });

    const { container } = await renderTable([alpha, zebra, middle]);

    await act(async () => {
      findButton(container, 'Level')?.click();
    });
    expectRenderedLevelOrder(container, ['alpha-level', 'middle-level', 'zebra-level']);

    await act(async () => {
      findButton(container, 'Level')?.click();
    });

    expectRenderedLevelOrder(container, ['zebra-level', 'middle-level', 'alpha-level']);
  });
});
