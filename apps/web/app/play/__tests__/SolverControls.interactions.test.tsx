// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SolverControls } from '../SolverControls';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];

type SolverControlsOverrides = Partial<React.ComponentProps<typeof SolverControls>>;

function getDefaultProps(): React.ComponentProps<typeof SolverControls> {
  return {
    status: 'idle',
    replayState: 'paused',
    workerHealth: 'healthy',
    hasSolution: true,
    replayIndex: 1,
    replayTotalSteps: 3,
    replaySpeed: 1,
    onRun: vi.fn(),
    onCancel: vi.fn(),
    onAnimate: vi.fn(),
    onReplayPlayPause: vi.fn(),
    onReplayStepBack: vi.fn(),
    onReplayStepForward: vi.fn(),
    onReplaySpeedChange: vi.fn(),
    onRetryWorker: vi.fn(),
  };
}

async function renderControls(overrides: SolverControlsOverrides = {}) {
  const props = { ...getDefaultProps(), ...overrides };
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<SolverControls {...props} />);
  });

  return { container, props };
}

function getButtonByText(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
}

function getReplaySpeedSelect(container: HTMLElement) {
  const label = container.querySelector('label[for="replay-speed-select"]');
  expect(label).toBeInstanceOf(HTMLLabelElement);
  if (!(label instanceof HTMLLabelElement)) {
    throw new Error('Expected replay speed label to be rendered.');
  }

  const select = container.querySelector('#replay-speed-select');
  expect(select).toBeInstanceOf(HTMLSelectElement);
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error('Expected replay speed select to be rendered.');
  }

  return select;
}

describe('SolverControls interactions', () => {
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

  it('invokes the enabled solver and replay control handlers on click', async () => {
    const { container, props } = await renderControls();

    await act(async () => {
      getButtonByText(container, 'Run Solve').click();
      getButtonByText(container, 'Animate Solution').click();
      getButtonByText(container, 'Play').click();
      getButtonByText(container, 'Step Back').click();
      getButtonByText(container, 'Step Forward').click();
    });

    expect(props.onRun).toHaveBeenCalledTimes(1);
    expect(props.onAnimate).toHaveBeenCalledTimes(1);
    expect(props.onReplayPlayPause).toHaveBeenCalledTimes(1);
    expect(props.onReplayStepBack).toHaveBeenCalledTimes(1);
    expect(props.onReplayStepForward).toHaveBeenCalledTimes(1);
  });

  it('keeps disabled controls inert while allowing retry worker interaction', async () => {
    const { container, props } = await renderControls({
      status: 'running',
      workerHealth: 'crashed',
      hasSolution: false,
      replayIndex: 0,
      replayTotalSteps: 0,
    });

    await act(async () => {
      getButtonByText(container, 'Run Solve').click();
      getButtonByText(container, 'Cancel').click();
      getButtonByText(container, 'Animate Solution').click();
      getButtonByText(container, 'Play').click();
      getButtonByText(container, 'Step Back').click();
      getButtonByText(container, 'Step Forward').click();
      getButtonByText(container, 'Retry Worker').click();
    });

    expect(props.onRun).not.toHaveBeenCalled();
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onAnimate).not.toHaveBeenCalled();
    expect(props.onReplayPlayPause).not.toHaveBeenCalled();
    expect(props.onReplayStepBack).not.toHaveBeenCalled();
    expect(props.onReplayStepForward).not.toHaveBeenCalled();
    expect(props.onRetryWorker).toHaveBeenCalledTimes(1);
  });

  it('forwards only positive finite replay speed values', async () => {
    const { container, props } = await renderControls();
    const select = getReplaySpeedSelect(container);

    await act(async () => {
      select.value = '0';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.value = '-1';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.value = 'Infinity';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.value = '4';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(props.onReplaySpeedChange).toHaveBeenCalledTimes(1);
    expect(props.onReplaySpeedChange).toHaveBeenCalledWith(4);
  });
});
