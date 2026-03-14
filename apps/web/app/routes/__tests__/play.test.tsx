import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { builtinLevels } from '@corgiban/levels';
import type { ReactNode } from 'react';
import type { PlayableEntry } from '../../levels/temporaryLevelCatalog';
import type { RequestedPlayableEntryResolution } from '../../levels/requestedPlayableEntry';

const mocks = vi.hoisted(() => ({
  createSolverPort: vi.fn(),
  createNoopSolverPort: vi.fn(),
  createAppStore: vi.fn(),
  isRouteErrorResponse: vi.fn(),
  useRequestedPlayableEntryResolution: vi.fn<[], RequestedPlayableEntryResolution<PlayableEntry>>(
    () => ({ status: 'none' }),
  ),
  useRouteError: vi.fn(),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
}));

const testState = vi.hoisted(() => ({
  playPageProps: null as null | Record<string, unknown>,
}));

vi.mock('../../play/PlayPage', () => ({
  PlayPage: (props: Record<string, unknown>) => {
    testState.playPageProps = props;
    return <div>play-page-stub</div>;
  },
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

vi.mock('../../levels/usePlayableLevels', () => ({
  useRequestedPlayableEntryResolution: mocks.useRequestedPlayableEntryResolution,
}));

vi.mock('@remix-run/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@remix-run/react')>();
  return {
    ...actual,
    Link: ({ children, to, ...props }: { children?: ReactNode; to: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    isRouteErrorResponse: mocks.isRouteErrorResponse,
    useRouteError: mocks.useRouteError,
    useSearchParams: mocks.useSearchParams,
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
    testState.playPageProps = null;
    const solverPort = createSolverPortMock();
    mocks.createSolverPort.mockReturnValue(solverPort);
    mocks.createNoopSolverPort.mockReturnValue(solverPort);
    mocks.createAppStore.mockReturnValue(createStoreMock());
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({ status: 'none' });
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

  it('forwards requested search params to PlayPage props', () => {
    mocks.useSearchParams.mockReturnValue([
      new URLSearchParams('levelId=test-level-2&algorithmId=astarPush'),
      vi.fn(),
    ]);

    renderToStaticMarkup(<PlayRoute />);

    expect(testState.playPageProps).toMatchObject({
      requestedLevelId: 'test-level-2',
      requestedAlgorithmId: 'astarPush',
    });
  });

  it('forwards exact levelRef handoff params to PlayPage props additively with legacy levelId', () => {
    mocks.useSearchParams.mockReturnValue([
      new URLSearchParams(
        'levelRef=temp:session-1&levelId=test-level-2&exactLevelKey=exact-key-1&algorithmId=astarPush',
      ),
      vi.fn(),
    ]);

    renderToStaticMarkup(<PlayRoute />);

    expect(testState.playPageProps).toMatchObject({
      requestedLevelRef: 'temp:session-1',
      requestedLevelId: 'test-level-2',
      requestedExactLevelKey: 'exact-key-1',
      requestedAlgorithmId: 'astarPush',
    });
  });

  it('renders a restore shell instead of unavailable UI while the client catalog is still pending', () => {
    mocks.useSearchParams.mockReturnValue([
      new URLSearchParams('levelRef=temp:session-1&levelId=test-level-2'),
      vi.fn(),
    ]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({
      status: 'pendingClientCatalog',
      requestedRef: 'temp:session-1',
      requestedLevelId: 'test-level-2',
    });

    const html = renderToStaticMarkup(<PlayRoute />);

    expect(html).toContain('Restoring session level');
    expect(html).not.toContain('Requested session level is unavailable');
    expect(testState.playPageProps).toBeNull();
  });

  it('omits builtin fallback actions for unavailable session refs whose levelId is not a builtin', () => {
    mocks.useSearchParams.mockReturnValue([
      new URLSearchParams('levelRef=temp:missing-session&levelId=custom-session-level'),
      vi.fn(),
    ]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({
      status: 'missingExactRef',
      requestedRef: 'temp:missing-session',
      fallbackLevelId: 'custom-session-level',
    });

    const html = renderToStaticMarkup(<PlayRoute />);

    expect(html).toContain('Requested session level is unavailable');
    expect(html).not.toContain('Open Built-In');
    expect(testState.playPageProps).toBeNull();
  });

  it('renders an unavailable shell instead of PlayPage when the requested entry is missing', () => {
    const fallbackLevelId = builtinLevels[0]?.id ?? 'corgiban-test-18';
    mocks.useSearchParams.mockReturnValue([
      new URLSearchParams(`levelRef=temp:missing-session&levelId=${fallbackLevelId}`),
      vi.fn(),
    ]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({
      status: 'missingExactRef',
      requestedRef: 'temp:missing-session',
      fallbackLevelId,
    });

    const html = renderToStaticMarkup(<PlayRoute />);

    expect(html).toContain('Requested session level is unavailable');
    expect(html).toContain('Open Built-In');
    expect(testState.playPageProps).toBeNull();
  });

  it('renders an unavailable shell when the requested exact level key no longer matches', () => {
    const fallbackLevelId = builtinLevels[0]?.id ?? 'corgiban-test-18';
    mocks.useSearchParams.mockReturnValue([
      new URLSearchParams(`levelRef=temp:missing-session&levelId=${fallbackLevelId}`),
      vi.fn(),
    ]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({
      status: 'missingExactKey',
      requestedRef: 'temp:missing-session',
      requestedLevelId: fallbackLevelId,
      requestedExactLevelKey: 'exact-key-1',
      fallbackLevelId,
    });

    const html = renderToStaticMarkup(<PlayRoute />);

    expect(html).toContain('Requested level version is unavailable');
    expect(html).toContain('Open Built-In');
    expect(testState.playPageProps).toBeNull();
  });

  it('omits builtin fallback actions when only an exact level key is unavailable', () => {
    mocks.useSearchParams.mockReturnValue([
      new URLSearchParams('exactLevelKey=exact-key-1'),
      vi.fn(),
    ]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({
      status: 'missingExactKey',
      requestedExactLevelKey: 'exact-key-1',
    });

    const html = renderToStaticMarkup(<PlayRoute />);

    expect(html).toContain('Requested level version is unavailable');
    expect(html).not.toContain('Open Built-In');
    expect(html).toContain('exact-key-1');
  });

  it('renders an unavailable shell when a legacy level id is missing from the catalog', () => {
    mocks.useSearchParams.mockReturnValue([new URLSearchParams('levelId=missing-level'), vi.fn()]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({
      status: 'missingLevelId',
      requestedLevelId: 'missing-level',
    });

    const html = renderToStaticMarkup(<PlayRoute />);

    expect(html).toContain('Requested level is unavailable');
    expect(html).toContain('Open Play');
    expect(html).toContain('missing-level');
    expect(testState.playPageProps).toBeNull();
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
