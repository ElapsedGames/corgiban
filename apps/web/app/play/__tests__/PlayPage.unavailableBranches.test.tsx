import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { builtinLevels } from '@corgiban/levels';

import { buildPlayHref } from '../../navigation/handoffLinks';
import { createAppStore } from '../../state/store';

const unavailableBranchState = vi.hoisted(() => ({
  resolution: null as null | Record<string, unknown>,
  requestedPlayableEntry: null as null | Record<string, unknown>,
  unavailableProps: null as null | Record<string, unknown>,
}));

vi.mock('../../levels/requestedPlayableEntry', () => ({
  resolveRequestedPlayableEntryFromEntries: () => unavailableBranchState.resolution,
}));

vi.mock('../../levels/usePlayableLevels', () => ({
  usePlayableCatalogSnapshot: () => ({
    entries: [],
    completeness: 'client-session-aware' as const,
  }),
  useResolvedPlayableEntry: () => unavailableBranchState.requestedPlayableEntry,
}));

vi.mock('../../levels/RequestedEntryPending', () => ({
  RequestedEntryPendingPage: () => <div data-testid="requested-entry-pending" />,
}));

vi.mock('../../levels/RequestedEntryUnavailable', () => ({
  RequestedEntryUnavailablePage: (props: Record<string, unknown>) => {
    unavailableBranchState.unavailableProps = props;
    return <div data-testid="requested-entry-unavailable" />;
  },
}));

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

import { PlayPage } from '../PlayPage';

function renderPage(props: Parameters<typeof PlayPage>[0] = {}, store = createAppStore()) {
  return {
    store,
    html: renderToStaticMarkup(
      <Provider store={store}>
        <PlayPage {...props} />
      </Provider>,
    ),
  };
}

describe('PlayPage unavailable-state branches', () => {
  beforeEach(() => {
    unavailableBranchState.requestedPlayableEntry = null;
    unavailableBranchState.unavailableProps = null;
  });

  it('offers an Open Built-In fallback when the missing active identity is a builtin level id', () => {
    const builtinLevelId = builtinLevels[0]?.id ?? 'level-001';
    unavailableBranchState.resolution = {
      status: 'missingLevelId',
      requestedLevelId: builtinLevelId,
    };

    renderPage();

    expect(unavailableBranchState.unavailableProps?.requestedIdentity).toBe(builtinLevelId);
    expect(unavailableBranchState.unavailableProps?.actions).toEqual(
      expect.arrayContaining([
        { label: 'Open Built-In', to: buildPlayHref({ levelId: builtinLevelId }) },
      ]),
    );
  });

  it('uses the exact-level key as the requested identity when only the exact version is missing', () => {
    unavailableBranchState.resolution = {
      status: 'missingExactKey',
      requestedRef: undefined,
      requestedLevelId: undefined,
      requestedExactLevelKey: 'session:exact-level-key',
      fallbackLevelId: undefined,
    };

    renderPage();

    expect(unavailableBranchState.unavailableProps?.heading).toBe(
      'Active level version is unavailable',
    );
    expect(unavailableBranchState.unavailableProps?.requestedIdentity).toBe(
      'session:exact-level-key',
    );
    expect(unavailableBranchState.unavailableProps?.actions).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ label: 'Open Built-In' })]),
    );
  });

  it('uses the missing requested ref when the exact session ref disappears', () => {
    unavailableBranchState.resolution = {
      status: 'missingExactRef',
      requestedRef: 'temp:missing-session-ref',
      fallbackLevelId: undefined,
    };

    renderPage();

    expect(unavailableBranchState.unavailableProps?.heading).toBe('Active level is unavailable');
    expect(unavailableBranchState.unavailableProps?.requestedIdentity).toBe(
      'temp:missing-session-ref',
    );
  });

  it('falls back to the active level ref when no specific requested identity can be recovered', () => {
    const store = createAppStore();
    unavailableBranchState.resolution = {
      status: 'none',
    };

    renderPage({}, store);

    expect(unavailableBranchState.unavailableProps?.heading).toBe('Active level is unavailable');
    expect(unavailableBranchState.unavailableProps?.requestedIdentity).toBe(
      store.getState().game.activeLevelRef,
    );
    expect(unavailableBranchState.unavailableProps?.actions).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ label: 'Open Built-In' })]),
    );
  });
});
