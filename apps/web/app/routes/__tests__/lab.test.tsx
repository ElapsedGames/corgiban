import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { builtinLevels } from '@corgiban/levels';
import type { ReactNode } from 'react';
import type { PlayableEntry } from '../../levels/temporaryLevelCatalog';
import type { RequestedPlayableEntryResolution } from '../../levels/requestedPlayableEntry';

const testState = vi.hoisted(() => ({
  initialLevel: undefined as PlayableEntry | undefined,
}));

const mocks = vi.hoisted(() => ({
  isRouteErrorResponse: vi.fn(),
  useRequestedPlayableEntryResolution: vi.fn<[], RequestedPlayableEntryResolution<PlayableEntry>>(
    () => ({ status: 'none' }),
  ),
  useRouteError: vi.fn(),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
}));

vi.mock('../../lab/LabPage', () => ({
  LabPage: ({ initialPlayable }: { initialPlayable?: PlayableEntry }) => {
    testState.initialLevel = initialPlayable;
    return <div>lab-page-stub</div>;
  },
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

import LabRoute, { ErrorBoundary } from '../lab';

describe('LabRoute', () => {
  beforeEach(() => {
    testState.initialLevel = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes the requested playable level into LabPage when levelId is present', () => {
    const level = {
      ref: 'temp:lab-temp-1',
      level: {
        id: 'lab-temp-1',
        name: 'Temporary Lab Level',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
      },
      source: { kind: 'session' as const },
    };
    mocks.useSearchParams.mockReturnValue([new URLSearchParams('levelId=lab-temp-1'), vi.fn()]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({
      status: 'resolved',
      entry: level,
    });

    const html = renderToStaticMarkup(<LabRoute />);

    expect(html).toContain('lab-page-stub');
    expect(mocks.useRequestedPlayableEntryResolution).toHaveBeenCalledWith({
      levelId: 'lab-temp-1',
      levelRef: null,
      exactLevelKey: null,
    });
    expect(testState.initialLevel).toEqual(level);
  });

  it('prefers the exact requested levelRef when present in the handoff params', () => {
    const level = {
      ref: 'temp:lab-temp-2',
      level: {
        id: 'lab-temp-legacy-id',
        name: 'Exact Ref Lab Level',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
      },
      source: { kind: 'session' as const, originRef: 'builtin:lab-base' },
    };
    mocks.useSearchParams.mockReturnValue([
      new URLSearchParams(
        'levelRef=temp:lab-temp-2&levelId=lab-temp-legacy-id&exactLevelKey=exact-key-1',
      ),
      vi.fn(),
    ]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({
      status: 'resolved',
      entry: level,
    });

    renderToStaticMarkup(<LabRoute />);

    expect(mocks.useRequestedPlayableEntryResolution).toHaveBeenCalledWith({
      levelId: 'lab-temp-legacy-id',
      levelRef: 'temp:lab-temp-2',
      exactLevelKey: 'exact-key-1',
    });
    expect(testState.initialLevel).toEqual(level);
  });

  it('renders without an initial level when no handoff level is present', () => {
    mocks.useSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({ status: 'none' });

    renderToStaticMarkup(<LabRoute />);

    expect(mocks.useRequestedPlayableEntryResolution).toHaveBeenCalledWith({
      levelId: null,
      levelRef: null,
      exactLevelKey: null,
    });
    expect(testState.initialLevel).toBeUndefined();
  });

  it('renders a restore shell while the client catalog is still pending', () => {
    mocks.useSearchParams.mockReturnValue([
      new URLSearchParams('levelRef=temp:missing-lab-entry&levelId=custom-lab-level'),
      vi.fn(),
    ]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({
      status: 'pendingClientCatalog',
      requestedRef: 'temp:missing-lab-entry',
      requestedLevelId: 'custom-lab-level',
    });

    const html = renderToStaticMarkup(<LabRoute />);

    expect(html).toContain('Restoring session source');
    expect(html).not.toContain('Requested session source is unavailable');
    expect(html).not.toContain('lab-page-stub');
  });

  it('omits builtin fallback actions for unavailable session refs whose levelId is not a builtin', () => {
    mocks.useSearchParams.mockReturnValue([
      new URLSearchParams('levelRef=temp:missing-lab-entry&levelId=custom-lab-level'),
      vi.fn(),
    ]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({
      status: 'missingExactRef',
      requestedRef: 'temp:missing-lab-entry',
      fallbackLevelId: 'custom-lab-level',
    });

    const html = renderToStaticMarkup(<LabRoute />);

    expect(html).toContain('Requested session source is unavailable');
    expect(html).not.toContain('Open Built-In');
    expect(html).not.toContain('lab-page-stub');
  });

  it('renders an unavailable shell instead of the starter editor when the requested entry is missing', () => {
    const fallbackLevelId = builtinLevels[0]?.id ?? 'corgiban-test-18';
    mocks.useSearchParams.mockReturnValue([
      new URLSearchParams(`levelRef=temp:missing-lab-entry&levelId=${fallbackLevelId}`),
      vi.fn(),
    ]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({
      status: 'missingExactRef',
      requestedRef: 'temp:missing-lab-entry',
      fallbackLevelId,
    });

    const html = renderToStaticMarkup(<LabRoute />);

    expect(html).toContain('Requested session source is unavailable');
    expect(html).not.toContain('lab-page-stub');
  });

  it('renders an unavailable shell when the requested exact level key no longer matches', () => {
    const fallbackLevelId = builtinLevels[0]?.id ?? 'corgiban-test-18';
    mocks.useSearchParams.mockReturnValue([
      new URLSearchParams(`levelRef=temp:missing-lab-entry&levelId=${fallbackLevelId}`),
      vi.fn(),
    ]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({
      status: 'missingExactKey',
      requestedRef: 'temp:missing-lab-entry',
      requestedLevelId: fallbackLevelId,
      requestedExactLevelKey: 'exact-key-1',
      fallbackLevelId,
    });

    const html = renderToStaticMarkup(<LabRoute />);

    expect(html).toContain('Requested level version is unavailable');
    expect(html).not.toContain('lab-page-stub');
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

    const html = renderToStaticMarkup(<LabRoute />);

    expect(html).toContain('Requested level version is unavailable');
    expect(html).not.toContain('Open Built-In');
    expect(html).toContain('exact-key-1');
  });

  it('renders an unavailable shell when a legacy level id is missing', () => {
    mocks.useSearchParams.mockReturnValue([new URLSearchParams('levelId=missing-level'), vi.fn()]);
    mocks.useRequestedPlayableEntryResolution.mockReturnValue({
      status: 'missingLevelId',
      requestedLevelId: 'missing-level',
    });

    const html = renderToStaticMarkup(<LabRoute />);

    expect(html).toContain('Requested level is unavailable');
    expect(html).toContain('Open Bench');
    expect(html).not.toContain('lab-page-stub');
  });
});

describe('LabRoute ErrorBoundary', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders route error responses with status metadata', () => {
    mocks.useRouteError.mockReturnValue({ status: 404, statusText: 'Not Found' });
    mocks.isRouteErrorResponse.mockReturnValue(true);

    const html = renderToStaticMarkup(<ErrorBoundary />);

    expect(html).toContain('Error 404');
    expect(html).toContain('Not Found');
  });

  it('renders generic error messages for thrown errors', () => {
    mocks.useRouteError.mockReturnValue(new Error('lab route failed'));
    mocks.isRouteErrorResponse.mockReturnValue(false);

    const html = renderToStaticMarkup(<ErrorBoundary />);

    expect(html).toContain('Something went wrong');
    expect(html).toContain('lab route failed');
  });

  it('falls back to HTTP status text when a route response omits statusText', () => {
    mocks.useRouteError.mockReturnValue({ status: 503, statusText: '' });
    mocks.isRouteErrorResponse.mockReturnValue(true);

    const html = renderToStaticMarkup(<ErrorBoundary />);

    expect(html).toContain('Error 503');
    expect(html).toContain('HTTP 503');
  });

  it('renders the unexpected-error fallback for non-Error throw values', () => {
    mocks.useRouteError.mockReturnValue({ unexpected: true });
    mocks.isRouteErrorResponse.mockReturnValue(false);

    const html = renderToStaticMarkup(<ErrorBoundary />);

    expect(html).toContain('Something went wrong');
    expect(html).toContain('An unexpected error occurred.');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/lab"');
  });
});
