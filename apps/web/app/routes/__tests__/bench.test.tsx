// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { builtinLevels } from '@corgiban/levels';

import {
  clearSessionPlayableEntries,
  toBuiltinLevelRef,
  upsertSessionPlayableEntry,
} from '../../levels/temporaryLevelCatalog';

const testState = vi.hoisted(() => ({
  benchPageProps: null as null | Record<string, unknown>,
  search: '',
}));

vi.mock('../../bench/BenchPage', () => ({
  BenchPage: (props: Record<string, unknown>) => {
    testState.benchPageProps = props;
    return <div>bench-page-stub</div>;
  },
}));

vi.mock('../../bench/performanceObserver.client', () => ({
  observeBenchPerformance: vi.fn(() => () => undefined),
  clearBenchPerformanceEntries: vi.fn(),
}));

vi.mock('@remix-run/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@remix-run/react')>();
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(testState.search), vi.fn()],
  };
});

import { createAppStore } from '../../state/store';
import { BenchRoutePage } from '../bench';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];

async function renderBenchRoutePage() {
  const store = createAppStore();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root);

  const render = async () => {
    await act(async () => {
      root.render(
        <Provider store={store}>
          <BenchRoutePage />
        </Provider>,
      );
    });
  };

  await render();
  return { root, store, rerender: render };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('BenchRoutePage handoff effects', () => {
  const requestedLevelId = builtinLevels[0]?.id ?? 'corgiban-test-1';
  const alternateLevelId = builtinLevels[1]?.id ?? 'corgiban-test-2';
  const thirdLevelId = builtinLevels[2]?.id ?? alternateLevelId;

  beforeEach(() => {
    document.body.innerHTML = '';
    testState.benchPageProps = null;
    testState.search = `levelId=${requestedLevelId}`;
    clearSessionPlayableEntries();
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
    clearSessionPlayableEntries();
    vi.clearAllMocks();
  });

  it('applies the requested level only once so users can expand the suite afterwards', async () => {
    const { store } = await renderBenchRoutePage();

    await flushEffects();
    expect(store.getState().bench.suite.levelRefs).toEqual([toBuiltinLevelRef(requestedLevelId)]);

    const onToggleLevel = testState.benchPageProps?.onToggleLevel as
      | ((levelId: string) => void)
      | undefined;
    expect(onToggleLevel).toBeTypeOf('function');

    await act(async () => {
      onToggleLevel?.(toBuiltinLevelRef(alternateLevelId));
    });

    await flushEffects();

    expect(store.getState().bench.suite.levelRefs).toEqual([
      toBuiltinLevelRef(requestedLevelId),
      toBuiltinLevelRef(alternateLevelId),
    ]);
    expect(testState.benchPageProps?.suite).toMatchObject({
      levelRefs: [toBuiltinLevelRef(requestedLevelId), toBuiltinLevelRef(alternateLevelId)],
    });
  });

  it('applies a new requested level when navigation changes the handoff param', async () => {
    const { store, rerender } = await renderBenchRoutePage();

    await flushEffects();
    expect(store.getState().bench.suite.levelRefs).toEqual([toBuiltinLevelRef(requestedLevelId)]);

    testState.search = `levelId=${thirdLevelId}`;
    await rerender();
    await flushEffects();

    expect(store.getState().bench.suite.levelRefs).toEqual([toBuiltinLevelRef(thirdLevelId)]);
    expect(testState.benchPageProps?.suite).toMatchObject({
      levelRefs: [toBuiltinLevelRef(thirdLevelId)],
    });
  });

  it('applies an exact requested levelRef without falling back through the canonical level id', async () => {
    const sessionEntry = upsertSessionPlayableEntry({
      level: {
        id: 'legacy-level-id',
        name: 'Bench Session Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    });
    testState.search = `levelRef=${encodeURIComponent(sessionEntry.ref)}&levelId=legacy-level-id`;
    const { store } = await renderBenchRoutePage();

    await flushEffects();

    expect(store.getState().bench.suite.levelRefs).toEqual([sessionEntry.ref]);
    expect(testState.benchPageProps?.suite).toMatchObject({
      levelRefs: [sessionEntry.ref],
    });
  });
});
