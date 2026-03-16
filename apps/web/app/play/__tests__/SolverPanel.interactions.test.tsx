// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAppStore } from '../../state/store';
import { SolverPanel, type SolverPanelProps } from '../SolverPanel';

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
    onAnimate: noop,
    onReplayPlayPause: noop,
    onReplayStepBack: noop,
    onReplayStepForward: noop,
    onReplaySpeedChange: noop,
    onRetryWorker: noop,
  };
}

function getControlByLabel<T extends HTMLElement>(container: HTMLElement, label: string): T {
  const labels = Array.from(container.querySelectorAll('label'));
  const match = labels.find((candidate) => candidate.textContent?.includes(label));
  expect(match).toBeDefined();

  const control = (match as HTMLLabelElement | undefined)?.control ?? null;
  expect(control).toBeInstanceOf(HTMLElement);
  return control as T;
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

async function setControlValue(control: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    if (control instanceof HTMLInputElement) {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      expect(valueSetter).toBeTypeOf('function');
      valueSetter?.call(control, value);
      control.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    expect(valueSetter).toBeTypeOf('function');
    valueSetter?.call(control, value);
    control.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function wait(ms: number) {
  await act(async () => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  });
}

describe('SolverPanel interactions', () => {
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

  it('floors positive decimal time budget input before storing it', async () => {
    const { container, store } = await renderPanel();
    const input = getControlByLabel<HTMLInputElement>(container, 'Time Budget (MS)');

    await setControlValue(input, '12.9');

    expect(store.getState().settings.solverTimeBudgetMs).toBe(12);
    expect(input.value).toBe('12');
  });

  it('keeps the existing time budget when the next value is zero', async () => {
    const { container, store } = await renderPanel();
    const input = getControlByLabel<HTMLInputElement>(container, 'Time Budget (MS)');
    const previousValue = store.getState().settings.solverTimeBudgetMs;

    await setControlValue(input, '0');

    expect(store.getState().settings.solverTimeBudgetMs).toBe(previousValue);
  });

  it('floors positive decimal node budget input before storing it', async () => {
    const { container, store } = await renderPanel();
    const input = getControlByLabel<HTMLInputElement>(container, 'Node Budget');

    await setControlValue(input, '41.7');

    expect(store.getState().settings.solverNodeBudget).toBe(41);
    expect(input.value).toBe('41');
  });

  it('calls onReplaySpeedChange for valid mobile replay speed updates', async () => {
    const onReplaySpeedChange = vi.fn();
    const { container } = await renderPanel({
      lastResult: {
        runId: 'solve-mobile-speed',
        algorithmId: 'bfsPush',
        status: 'solved',
        solutionMoves: 'RR',
        metrics: {
          elapsedMs: 10,
          expanded: 5,
          generated: 6,
          maxDepth: 2,
          maxFrontier: 3,
          pushCount: 1,
          moveCount: 2,
        },
      },
      onReplaySpeedChange,
    });
    const select = container.querySelector('select[aria-label="Mobile replay speed"]');
    expect(select).toBeInstanceOf(HTMLSelectElement);
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Expected mobile replay speed select to be rendered.');
    }

    await setControlValue(select, '2');

    expect(onReplaySpeedChange).toHaveBeenCalledWith(2);
  });

  it('ignores non-positive mobile replay speed values', async () => {
    const onReplaySpeedChange = vi.fn();
    const { container } = await renderPanel({
      lastResult: {
        runId: 'solve-mobile-speed-invalid',
        algorithmId: 'bfsPush',
        status: 'solved',
        solutionMoves: 'RR',
        metrics: {
          elapsedMs: 10,
          expanded: 5,
          generated: 6,
          maxDepth: 2,
          maxFrontier: 3,
          pushCount: 1,
          moveCount: 2,
        },
      },
      onReplaySpeedChange,
    });
    const select = container.querySelector('select[aria-label="Mobile replay speed"]');
    expect(select).toBeInstanceOf(HTMLSelectElement);
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Expected mobile replay speed select to be rendered.');
    }

    await setControlValue(select, '0');

    expect(onReplaySpeedChange).not.toHaveBeenCalled();
  });

  it('shows the retry worker action on mobile when a locked level also has a crashed worker', async () => {
    const { container } = await renderPanel({
      error: 'Worker crashed.',
      mobileRunLocked: true,
      status: 'failed',
      workerHealth: 'crashed',
    });

    const group = container.querySelector('[aria-label="Mobile solver controls"]');
    expect(group).toBeTruthy();
    expect(group?.textContent).toContain('Retry Worker');
    expect(group?.textContent).not.toContain('Run Solve');
    expect(group?.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it('shows cancelling status text after the mobile running delay when no progress snapshot exists', async () => {
    const { container } = await renderPanel({
      status: 'cancelling',
    });

    await wait(800);

    expect(container.textContent).toContain('Stopping solver...');
    expect(container.textContent).toContain('Cancelling');
  });
});
