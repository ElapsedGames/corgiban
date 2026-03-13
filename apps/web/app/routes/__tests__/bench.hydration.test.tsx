// @vitest-environment jsdom

import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LevelDefinition } from '@corgiban/levels';

const mocks = vi.hoisted(() => ({
  observeBenchPerformance: vi.fn(() => () => undefined),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
}));

vi.mock('../../bench/performanceObserver.client', () => ({
  clearBenchPerformanceEntries: vi.fn(),
  observeBenchPerformance: mocks.observeBenchPerformance,
}));

vi.mock('@remix-run/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@remix-run/react')>();
  return {
    ...actual,
    useSearchParams: mocks.useSearchParams,
  };
});

import { clearTemporaryLevels, upsertTemporaryLevels } from '../../levels/temporaryLevelCatalog';
import { createAppStore } from '../../state/store';
import { BenchRoutePage } from '../bench';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('BenchRoute hydration', () => {
  let root: Root | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    clearTemporaryLevels();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }

    sessionStorage.clear();
    clearTemporaryLevels();
    vi.clearAllMocks();
  });

  it('hydrates cleanly when temporary playable levels exist only in browser session storage', async () => {
    const temporaryLevel: LevelDefinition = {
      id: 'bench-hydration-temp',
      name: 'Hydration Temp Level',
      rows: ['WWWWW', 'WPTBW', 'WWWWW'],
    };
    upsertTemporaryLevels([temporaryLevel]);

    const store = createAppStore();
    const app = (
      <Provider store={store}>
        <BenchRoutePage />
      </Provider>
    );

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const markup = renderToString(app);
      consoleErrorSpy.mockClear();
      document.body.innerHTML = `<div id="root">${markup}</div>`;

      const container = document.getElementById('root');
      if (!container) {
        throw new Error('Missing root container.');
      }

      await act(async () => {
        root = hydrateRoot(container, app);
      });
      await flushEffects();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(container.textContent).toContain('Hydration Temp Level (session)');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
