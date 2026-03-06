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

  it('uses fallback level metadata when builtin levels are empty', () => {
    const { html } = renderPage();

    expect(html).toContain('Unknown');
    expect(emptyLevelState.sidePanelProps?.levelId).toBe('level-unknown');
    expect(emptyLevelState.sidePanelProps?.levelName).toBe('Unknown');
    expect(emptyLevelState.sidePanelProps?.canGoToPreviousLevel).toBe(false);
  });

  it('keeps the current level id when next-level is requested with an empty level catalog', () => {
    const { store } = renderPage();
    const onNextLevel = emptyLevelState.sidePanelProps?.onNextLevel as (() => void) | undefined;
    expect(onNextLevel).toBeTypeOf('function');

    onNextLevel?.();

    expect(store.getState().game.levelId).toBe('level-unknown');
  });

  it('keeps the current level id when previous-level is requested with an empty level catalog', () => {
    const { store } = renderPage();
    const onPreviousLevel = emptyLevelState.sidePanelProps?.onPreviousLevel as
      | (() => void)
      | undefined;
    expect(onPreviousLevel).toBeTypeOf('function');

    onPreviousLevel?.();

    expect(store.getState().game.levelId).toBe('level-unknown');
  });
});
