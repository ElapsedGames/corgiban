// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replayBranchState = vi.hoisted(() => ({
  solverPanelProps: null as null | Record<string, unknown>,
  sidePanelProps: null as null | Record<string, unknown>,
  controllerInstances: [] as Array<{
    stop: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    stepBack: ReturnType<typeof vi.fn>;
    stepForward: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('../../replay/replayController.client', () => ({
  ReplayController: class {
    stop = vi.fn();
    start = vi.fn();
    pause = vi.fn();
    stepBack = vi.fn();
    stepForward = vi.fn();

    constructor() {
      replayBranchState.controllerInstances.push(this);
    }
  },
}));

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

vi.mock('../useKeyboardControls', () => ({
  useKeyboardControls: () => undefined,
}));

import { createAppStore } from '../../state/store';
import { setReplayState } from '../../state/solverSlice';
import { PlayPage } from '../PlayPage';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];

async function renderPage(store = createAppStore()) {
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

  return { root, store };
}

describe('PlayPage replay controller branches', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    replayBranchState.solverPanelProps = null;
    replayBranchState.sidePanelProps = null;
    replayBranchState.controllerInstances.length = 0;
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
  });

  it('invokes replay controller callbacks when a controller ref is available', async () => {
    await renderPage();

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

    await act(async () => {
      onReplayPlayPause?.();
      onReplayStepBack?.();
      onReplayStepForward?.();
      onUndo?.();
    });

    const controller = replayBranchState.controllerInstances.at(-1);
    expect(controller?.start).toHaveBeenCalledTimes(1);
    expect(controller?.stepBack).toHaveBeenCalledTimes(1);
    expect(controller?.stepForward).toHaveBeenCalledTimes(1);
    expect(controller?.stop).toHaveBeenCalledTimes(1);
  });

  it('pauses replay when replay state is playing', async () => {
    const store = createAppStore();
    await renderPage(store);

    await act(async () => {
      store.dispatch(setReplayState('playing'));
    });

    const onReplayPlayPause = replayBranchState.solverPanelProps?.onReplayPlayPause as
      | (() => void)
      | undefined;
    expect(onReplayPlayPause).toBeTypeOf('function');

    await act(async () => {
      onReplayPlayPause?.();
    });

    const controller = replayBranchState.controllerInstances.at(-1);
    expect(controller?.pause).toHaveBeenCalledTimes(1);
    expect(controller?.start).not.toHaveBeenCalled();
  });
});
