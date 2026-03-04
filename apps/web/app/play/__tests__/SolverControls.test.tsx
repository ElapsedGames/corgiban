import { describe, expect, it } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';

import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { SolverControls } from '../SolverControls';

type ButtonElement = ReactElement<{ children?: ReactNode; disabled?: boolean }>;

function collectButtons(node: unknown, results: ButtonElement[] = []) {
  if (!node) {
    return results;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectButtons(child, results));
    return results;
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    if (node.type === Button) {
      results.push(node as ButtonElement);
    }
    collectButtons(node.props?.children, results);
  }
  return results;
}

function getButtonByLabel(buttons: ButtonElement[], label: string) {
  return buttons.find((button) => button.props.children === label);
}

function findByType(node: unknown, targetType: unknown): ReactElement | undefined {
  if (!node) {
    return undefined;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findByType(child, targetType);
      if (match) {
        return match;
      }
    }
    return undefined;
  }
  if (!isValidElement<{ children?: unknown }>(node)) {
    return undefined;
  }
  if (node.type === targetType) {
    return node;
  }
  return findByType(node.props?.children, targetType);
}

describe('SolverControls', () => {
  const noop = () => undefined;

  it('shows retry and disables run when worker is crashed', () => {
    const element = SolverControls({
      status: 'idle',
      replayState: 'idle',
      workerHealth: 'crashed',
      hasSolution: false,
      replayIndex: 0,
      replayTotalSteps: 0,
      replaySpeed: 1,
      onRun: noop,
      onCancel: noop,
      onApply: noop,
      onAnimate: noop,
      onReplayPlayPause: noop,
      onReplayStepBack: noop,
      onReplayStepForward: noop,
      onReplaySpeedChange: noop,
      onRetryWorker: noop,
    });

    const buttons = collectButtons(element);
    const runButton = getButtonByLabel(buttons, 'Run solve');
    const retryButton = getButtonByLabel(buttons, 'Retry worker');

    expect(runButton?.props.disabled).toBe(true);
    expect(retryButton).toBeDefined();
  });

  it('disables apply/animate when no solution is available', () => {
    const element = SolverControls({
      status: 'idle',
      replayState: 'idle',
      workerHealth: 'healthy',
      hasSolution: false,
      replayIndex: 0,
      replayTotalSteps: 0,
      replaySpeed: 1,
      onRun: noop,
      onCancel: noop,
      onApply: noop,
      onAnimate: noop,
      onReplayPlayPause: noop,
      onReplayStepBack: noop,
      onReplayStepForward: noop,
      onReplaySpeedChange: noop,
      onRetryWorker: noop,
    });

    const buttons = collectButtons(element);
    const applyButton = getButtonByLabel(buttons, 'Apply solution');
    const animateButton = getButtonByLabel(buttons, 'Animate solution');
    const playButton = getButtonByLabel(buttons, 'Play replay');

    expect(applyButton?.props.disabled).toBe(true);
    expect(animateButton?.props.disabled).toBe(true);
    expect(playButton?.props.disabled).toBe(true);
  });

  it('disables run while solving and shows pause label when replaying', () => {
    const running = SolverControls({
      status: 'running',
      replayState: 'playing',
      workerHealth: 'healthy',
      hasSolution: true,
      replayIndex: 1,
      replayTotalSteps: 3,
      replaySpeed: 1,
      onRun: noop,
      onCancel: noop,
      onApply: noop,
      onAnimate: noop,
      onReplayPlayPause: noop,
      onReplayStepBack: noop,
      onReplayStepForward: noop,
      onReplaySpeedChange: noop,
      onRetryWorker: noop,
    });

    const runningButtons = collectButtons(running);
    const runButton = getButtonByLabel(runningButtons, 'Run solve');
    const cancelButton = getButtonByLabel(runningButtons, 'Cancel');
    const pauseButton = getButtonByLabel(runningButtons, 'Pause replay');
    const stepBack = getButtonByLabel(runningButtons, 'Step back');
    const stepForward = getButtonByLabel(runningButtons, 'Step forward');

    expect(runButton?.props.disabled).toBe(true);
    expect(cancelButton?.props.disabled).toBe(false);
    expect(pauseButton?.props.disabled).toBe(false);
    expect(stepBack?.props.disabled).toBe(false);
    expect(stepForward?.props.disabled).toBe(false);

    const cancelling = SolverControls({
      status: 'cancelling',
      replayState: 'paused',
      workerHealth: 'healthy',
      hasSolution: true,
      replayIndex: 0,
      replayTotalSteps: 1,
      replaySpeed: 1,
      onRun: noop,
      onCancel: noop,
      onApply: noop,
      onAnimate: noop,
      onReplayPlayPause: noop,
      onReplayStepBack: noop,
      onReplayStepForward: noop,
      onReplaySpeedChange: noop,
      onRetryWorker: noop,
    });

    const cancellingButtons = collectButtons(cancelling);
    const cancellingRun = getButtonByLabel(cancellingButtons, 'Run solve');
    expect(cancellingRun?.props.disabled).toBe(true);
  });

  it('exposes replay speed selector and forwards numeric speed changes', () => {
    const speedCalls: number[] = [];
    const element = SolverControls({
      status: 'idle',
      replayState: 'idle',
      workerHealth: 'healthy',
      hasSolution: true,
      replayIndex: 0,
      replayTotalSteps: 2,
      replaySpeed: 1,
      onRun: noop,
      onCancel: noop,
      onApply: noop,
      onAnimate: noop,
      onReplayPlayPause: noop,
      onReplayStepBack: noop,
      onReplayStepForward: noop,
      onReplaySpeedChange: (speed) => {
        speedCalls.push(speed);
      },
      onRetryWorker: noop,
    });

    const select = findByType(element, Select);

    expect(select).toBeDefined();
    expect(select?.props.value).toBe('1');

    select?.props.onChange({ target: { value: '1.5' } } as { target: { value: string } });
    select?.props.onChange({ target: { value: 'not-a-number' } } as { target: { value: string } });

    expect(speedCalls).toEqual([1.5]);
  });
});
