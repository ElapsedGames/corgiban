// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAppStore } from '../../state/store';
import {
  SolverPanel,
  type SolverPanelProps,
  MOBILE_RUNNING_INDICATOR_DELAY_MS,
} from '../SolverPanel';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];

const noop = () => undefined;

function getBaseProps(): SolverPanelProps {
  return {
    recommendation: null,
    selectedAlgorithmId: 'bfsPush',
    status: 'idle',
    progress: null,
    lastResult: null,
    error: null,
    workerHealth: 'healthy',
    replayState: 'idle',
    replayIndex: 0,
    replayTotalSteps: 0,
    replaySpeed: 1,
    mobileRunLocked: false,
    onSelectAlgorithm: noop,
    onRun: noop,
    onCancel: noop,
    onApply: noop,
    onAnimate: noop,
    onReplayPlayPause: noop,
    onReplayStepBack: noop,
    onReplayStepForward: noop,
    onReplaySpeedChange: noop,
    onRetryWorker: noop,
  };
}

async function renderPanel(overrides: Partial<SolverPanelProps> = {}) {
  const props = { ...getBaseProps(), ...overrides };
  const store = createAppStore();
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(
      <Provider store={store}>
        <SolverPanel {...props} />
      </Provider>,
    );
  });

  return { container, props, root, store };
}

describe('SolverPanel mobile running delay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
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

  async function wait(ms: number) {
    await act(async () => {
      await new Promise((resolve) => {
        window.setTimeout(resolve, ms);
      });
    });
  }

  it('waits 750 ms before showing the mobile running indicator', async () => {
    const { container } = await renderPanel({
      status: 'running',
      progress: {
        runId: 'solve-running-delay',
        elapsedMs: 123.7,
        expanded: 10,
        generated: 14,
        depth: 3,
        frontier: 8,
      },
    });

    expect(container.textContent).not.toContain('Solver running...');

    await wait(300);

    expect(container.textContent).not.toContain('Solver running...');

    await wait(MOBILE_RUNNING_INDICATOR_DELAY_MS);

    expect(container.textContent).toContain('Solver running...');
    expect(container.textContent).toContain('124 ms');
  });

  it('never shows the mobile running indicator if solving finishes before the delay', async () => {
    const { container, root, store } = await renderPanel({
      status: 'running',
      progress: {
        runId: 'solve-running-finish-fast',
        elapsedMs: 12,
        expanded: 1,
        generated: 2,
        depth: 1,
        frontier: 1,
      },
    });

    await act(async () => {
      root.render(
        <Provider store={store}>
          <SolverPanel
            {...getBaseProps()}
            status="succeeded"
            progress={null}
            lastResult={{
              runId: 'solve-running-finish-fast',
              algorithmId: 'bfsPush',
              status: 'solved',
              solutionMoves: 'R',
              metrics: {
                elapsedMs: 12,
                expanded: 1,
                generated: 2,
                maxDepth: 1,
                maxFrontier: 1,
                pushCount: 1,
                moveCount: 1,
              },
            }}
          />
        </Provider>,
      );
    });

    await wait(MOBILE_RUNNING_INDICATOR_DELAY_MS + 100);

    expect(container.textContent).not.toContain('Solver running...');
  });
});
