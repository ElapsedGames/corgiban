import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';

vi.mock('@corgiban/levels', () => ({
  builtinLevels: [],
}));

const emptyLevelState = vi.hoisted(() => ({
  sidePanelProps: null as null | Record<string, unknown>,
}));

vi.mock('../../canvas/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="game-canvas-stub" />,
}));

vi.mock('../SidePanel', () => ({
  SidePanel: (props: Record<string, unknown>) => {
    emptyLevelState.sidePanelProps = props;
    return <div data-testid="side-panel-stub" />;
  },
}));

vi.mock('../BottomControls', () => ({
  BottomControls: () => <div data-testid="bottom-controls-stub" />,
}));

vi.mock('../SolverPanel', () => ({
  SolverPanel: () => <div data-testid="solver-panel-stub" />,
}));

import { createAppStore } from '../../state/store';
import { PlayPage } from '../PlayPage';

function renderPage(store = createAppStore()) {
  const html = renderToStaticMarkup(
    <Provider store={store}>
      <PlayPage />
    </Provider>,
  );
  return { store, html };
}

describe('PlayPage empty-level fallback behavior', () => {
  beforeEach(() => {
    emptyLevelState.sidePanelProps = null;
  });

  it('renders a restore shell while the active level cannot be verified against an empty server snapshot', () => {
    const { html } = renderPage();

    expect(html).toContain('Restoring active level');
    expect(emptyLevelState.sidePanelProps).toBeNull();
  });

  it('does not expose next-level navigation when the active level cannot be verified', () => {
    const { store } = renderPage();
    const onNextLevel = emptyLevelState.sidePanelProps?.onNextLevel as (() => void) | undefined;
    expect(onNextLevel).toBeUndefined();

    expect(store.getState().game.levelId).toBe('level-unknown');
  });

  it('does not expose previous-level navigation when the active level cannot be verified', () => {
    const { store } = renderPage();
    const onPreviousLevel = emptyLevelState.sidePanelProps?.onPreviousLevel as
      | (() => void)
      | undefined;
    expect(onPreviousLevel).toBeUndefined();

    expect(store.getState().game.levelId).toBe('level-unknown');
  });
});
