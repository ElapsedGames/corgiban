import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
  createSolverPort: vi.fn(),
  createNoopSolverPort: vi.fn(),
  createAppStore: vi.fn(),
  isRouteErrorResponse: vi.fn(),
  useRouteError: vi.fn(),
}));

vi.mock('../../play/PlayPage', () => ({
  PlayPage: () => <div>play-page-stub</div>,
}));

vi.mock('../../ports/solverPort.client', () => ({
  createSolverPort: mocks.createSolverPort,
}));

vi.mock('../../ports/solverPort', () => ({
  createNoopSolverPort: mocks.createNoopSolverPort,
}));

vi.mock('../../state', () => ({
  createAppStore: mocks.createAppStore,
}));

vi.mock('@remix-run/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@remix-run/react')>();
  return {
    ...actual,
    isRouteErrorResponse: mocks.isRouteErrorResponse,
    useRouteError: mocks.useRouteError,
  };
});

import PlayRoute, { ErrorBoundary } from '../play';

function createStoreMock() {
  return {
    getState: () => ({}),
    dispatch: () => undefined,
    subscribe: () => () => undefined,
    replaceReducer: () => undefined,
    dispose: () => undefined,
  };
}

function createSolverPortMock() {
  return {
    startSolve: async () => {
      throw new Error('not used');
    },
    cancelSolve: () => undefined,
    pingWorker: async () => undefined,
    retryWorker: () => undefined,
    getWorkerHealth: () => 'idle' as const,
    subscribeWorkerHealth: () => () => undefined,
    dispose: () => undefined,
  };
}

describe('PlayRoute', () => {
  beforeEach(() => {
    const solverPort = createSolverPortMock();
    mocks.createSolverPort.mockReturnValue(solverPort);
    mocks.createNoopSolverPort.mockReturnValue(solverPort);
    mocks.createAppStore.mockReturnValue(createStoreMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uses noop solver port during server-side rendering', () => {
    vi.stubGlobal('document', undefined as never);

    const html = renderToStaticMarkup(<PlayRoute />);

    expect(html).toContain('play-page-stub');
    expect(mocks.createNoopSolverPort).toHaveBeenCalledTimes(1);
    expect(mocks.createSolverPort).not.toHaveBeenCalled();
  });

  it('defers browser solver port creation until the route commits', () => {
    vi.stubGlobal('document', {} as never);

    renderToStaticMarkup(<PlayRoute />);

    expect(mocks.createNoopSolverPort).toHaveBeenCalledTimes(1);
    expect(mocks.createSolverPort).not.toHaveBeenCalled();
  });
});

describe('PlayRoute ErrorBoundary', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders route error responses with status metadata', () => {
    mocks.useRouteError.mockReturnValue({ status: 404, statusText: 'Not Found' });
    mocks.isRouteErrorResponse.mockReturnValue(true);

    const html = renderToStaticMarkup(<ErrorBoundary />);

    expect(html).toContain('404 Not Found');
  });

  it('renders generic error messages for thrown errors', () => {
    mocks.useRouteError.mockReturnValue(new Error('route failed'));
    mocks.isRouteErrorResponse.mockReturnValue(false);

    const html = renderToStaticMarkup(<ErrorBoundary />);

    expect(html).toContain('route failed');
  });

  it('renders the unknown fallback message for non-Error throw values', () => {
    mocks.useRouteError.mockReturnValue({ unexpected: true });
    mocks.isRouteErrorResponse.mockReturnValue(false);

    const html = renderToStaticMarkup(<ErrorBoundary />);

    expect(html).toContain('Unknown error');
  });
});
