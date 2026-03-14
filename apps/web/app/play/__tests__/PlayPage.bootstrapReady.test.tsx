// @vitest-environment jsdom

import { createRoot, type Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

declare global {
  var __PLAYPAGE_BOOTSTRAP_STATE__: { status: 'restoring'; targetRef: string } | undefined;
}

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();

  return {
    ...actual,
    useState: ((initial: unknown) => {
      if (
        typeof initial === 'object' &&
        initial !== null &&
        'status' in initial &&
        initial.status === 'pending' &&
        globalThis.__PLAYPAGE_BOOTSTRAP_STATE__
      ) {
        return actual.useState(globalThis.__PLAYPAGE_BOOTSTRAP_STATE__);
      }

      return actual.useState(initial);
    }) as typeof actual.useState,
  };
});

vi.mock('../../canvas/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="game-canvas-stub" />,
}));

vi.mock('../SidePanel', () => ({
  SidePanel: () => <div data-testid="side-panel-stub" />,
}));

vi.mock('../BottomControls', () => ({
  BottomControls: () => <div data-testid="bottom-controls-stub" />,
}));

vi.mock('../SolverPanel', () => ({
  SolverPanel: () => <div data-testid="solver-panel-stub" />,
}));

vi.mock('../useKeyboardControls', () => ({
  useKeyboardControls: () => undefined,
}));

import { createAppStore } from '../../state/store';
import { PlayPage } from '../PlayPage';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];

describe('PlayPage play-progress bootstrap ready transition', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    globalThis.__PLAYPAGE_BOOTSTRAP_STATE__ = undefined;
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
    globalThis.__PLAYPAGE_BOOTSTRAP_STATE__ = undefined;
  });

  it('completes the restoring bootstrap effect when the active playable ref already matches the target', async () => {
    const store = createAppStore();
    globalThis.__PLAYPAGE_BOOTSTRAP_STATE__ = {
      status: 'restoring',
      targetRef: store.getState().game.activeLevelRef ?? 'builtin:level-001',
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    await act(async () => {
      root.render(
        <Provider store={store}>
          <PlayPage />
        </Provider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="game-canvas-stub"]')).not.toBeNull();
  });
});
