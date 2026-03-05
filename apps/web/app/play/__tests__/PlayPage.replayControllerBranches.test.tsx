import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';

const replayBranchState = vi.hoisted(() => ({
  solverPanelProps: null as null | Record<string, unknown>,
  sidePanelProps: null as null | Record<string, unknown>,
  refCallCount: 0,
  controller: null as null | {
    stop: () => void;
    start: () => void;
    pause: () => void;
    stepBack: () => void;
    stepForward: () => void;
  },
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useRef: <T,>(initial: T) => {
      const ref = actual.useRef(initial);
      replayBranchState.refCallCount += 1;
      const refSlot = ((replayBranchState.refCallCount - 1) % 3) + 1;
      if (refSlot === 2 && replayBranchState.controller) {
        (ref as { current: unknown }).current = replayBranchState.controller;
      }
      return ref;
    },
  };
});

vi.mock('../../canvas/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="game-canvas-stub" />,
}));

vi.mock('../SidePanel', () => ({
  SidePanel: (props: Record<string, unknown>) => {
    replayBranchState.sidePanelProps = props;
    return <div data-testid="side-panel-stub" />;
  },
}));

vi.mock('../BottomControls', () => ({
  BottomControls: () => <div data-testid="bottom-controls-stub" />,
}));

vi.mock('../SolverPanel', () => ({
  SolverPanel: (props: Record<string, unknown>) => {
    replayBranchState.solverPanelProps = props;
    return <div data-testid="solver-panel-stub" />;
  },
}));

import { createAppStore } from '../../state/store';
import { setReplayState } from '../../state/solverSlice';
import { PlayPage } from '../PlayPage';

function renderPage(store = createAppStore()) {
  replayBranchState.refCallCount = 0;
  renderToStaticMarkup(
    <Provider store={store}>
      <PlayPage />
    </Provider>,
  );
  return store;
}

describe('PlayPage replay controller branches', () => {
  beforeEach(() => {
    replayBranchState.solverPanelProps = null;
    replayBranchState.sidePanelProps = null;
    replayBranchState.refCallCount = 0;
    replayBranchState.controller = {
      stop: vi.fn(),
      start: vi.fn(),
      pause: vi.fn(),
      stepBack: vi.fn(),
      stepForward: vi.fn(),
    };
  });

  it('invokes replay controller callbacks when a controller ref is available', () => {
    renderPage();

    const onReplayPlayPause = replayBranchState.solverPanelProps?.onReplayPlayPause as
      | (() => void)
      | undefined;
    const onReplayStepBack = replayBranchState.solverPanelProps?.onReplayStepBack as
      | (() => void)
      | undefined;
    const onReplayStepForward = replayBranchState.solverPanelProps?.onReplayStepForward as
      | (() => void)
      | undefined;
    const onUndo = replayBranchState.sidePanelProps?.onUndo as (() => void) | undefined;

    expect(onReplayPlayPause).toBeTypeOf('function');
    expect(onReplayStepBack).toBeTypeOf('function');
    expect(onReplayStepForward).toBeTypeOf('function');
    expect(onUndo).toBeTypeOf('function');

    onReplayPlayPause?.();
    onReplayStepBack?.();
    onReplayStepForward?.();
    onUndo?.();

    expect(replayBranchState.controller?.start).toHaveBeenCalledTimes(1);
    expect(replayBranchState.controller?.stepBack).toHaveBeenCalledTimes(1);
    expect(replayBranchState.controller?.stepForward).toHaveBeenCalledTimes(1);
    expect(replayBranchState.controller?.stop).toHaveBeenCalledTimes(1);
  });

  it('pauses replay when replay state is playing', () => {
    const store = createAppStore();
    store.dispatch(setReplayState('playing'));

    renderPage(store);

    const onReplayPlayPause = replayBranchState.solverPanelProps?.onReplayPlayPause as
      | (() => void)
      | undefined;
    expect(onReplayPlayPause).toBeTypeOf('function');

    onReplayPlayPause?.();

    expect(replayBranchState.controller?.pause).toHaveBeenCalledTimes(1);
    expect(replayBranchState.controller?.start).not.toHaveBeenCalled();
  });
});
