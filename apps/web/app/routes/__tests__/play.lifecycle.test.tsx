// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  PlayableEntry,
  RequestedPlayableEntryResolution,
} from '../../levels/temporaryLevelCatalog';
import PlayRoute from '../play';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

function createSolverPortMock() {
  return {
    startSolve: vi.fn(async () => {
      throw new Error('not used');
    }),
    cancelSolve: vi.fn(),
    pingWorker: vi.fn(async () => undefined),
    retryWorker: vi.fn(),
    getWorkerHealth: vi.fn(() => 'idle' as const),
    subscribeWorkerHealth: vi.fn(() => () => undefined),
    dispose: vi.fn(),
  };
}

const mocks = vi.hoisted(() => ({
  createSolverPort: vi.fn(),
  useRequestedPlayableEntryResolution: vi.fn(
    (): RequestedPlayableEntryResolution<PlayableEntry> => ({ status: 'none' }),
  ),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
}));

vi.mock('../../play/PlayPage', () => ({
  PlayPage: () => <div>play-page-stub</div>,
}));

vi.mock('../../ports/solverPort.client', () => ({
  createSolverPort: mocks.createSolverPort,
}));

vi.mock('../../levels/usePlayableLevels', () => ({
  useRequestedPlayableEntryResolution: mocks.useRequestedPlayableEntryResolution,
}));

vi.mock('@remix-run/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@remix-run/react')>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      ...props
    }: {
      children?: ReactNode;
      to: string;
      [key: string]: unknown;
    }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useSearchParams: mocks.useSearchParams,
  };
});

const mountedRoots: Root[] = [];

async function renderRoute() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<PlayRoute />);
  });

  return { container, root };
}

async function unmountRoot(root: Root) {
  const index = mountedRoots.indexOf(root);
  if (index >= 0) {
    mountedRoots.splice(index, 1);
  }

  await act(async () => {
    root.unmount();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop();
    await act(async () => {
      root?.unmount();
    });
  }

  document.body.innerHTML = '';
});

describe('PlayRoute lifecycle', () => {
  it('disposes the owned solver port when the route unmounts', async () => {
    const solverPort = createSolverPortMock();
    mocks.createSolverPort.mockReturnValue(solverPort);

    const { root } = await renderRoute();

    expect(mocks.createSolverPort).toHaveBeenCalledTimes(1);
    expect(solverPort.dispose).not.toHaveBeenCalled();

    await unmountRoot(root);

    expect(solverPort.dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps unavailable handoffs on the noop port path in the browser', async () => {
    mocks.useSearchParams.mockReturnValue([new URLSearchParams('levelId=missing-level'), vi.fn()]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({
      status: 'missingLevelId',
      requestedLevelId: 'missing-level',
    });

    const { container, root } = await renderRoute();

    expect(container.textContent).toContain('Requested level is unavailable');
    expect(mocks.createSolverPort).not.toHaveBeenCalled();

    await unmountRoot(root);
  });
});
