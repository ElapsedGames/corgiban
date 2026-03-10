import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';

import { Button } from '../../ui/Button';
import { SolverControls } from '../SolverControls';

type ButtonElement = ReactElement<{
  children?: ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'tonal' | 'ghost' | 'destructive';
}>;

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

function findByElementType(node: unknown, targetType: string): ReactElement | undefined {
  return findByType(node, targetType);
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
    const runButton = getButtonByLabel(buttons, 'Run Solve');
    const retryButton = getButtonByLabel(buttons, 'Retry Worker');

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
    const applyButton = getButtonByLabel(buttons, 'Apply Solution');
    const animateButton = getButtonByLabel(buttons, 'Animate Solution');
    const playButton = getButtonByLabel(buttons, 'Play');

    expect(applyButton?.props.disabled).toBe(true);
    expect(animateButton?.props.disabled).toBe(true);
    expect(playButton?.props.disabled).toBe(true);
  });

  it('uses tonal solution actions and a secondary retry action', () => {
    const element = SolverControls({
      status: 'idle',
      replayState: 'idle',
      workerHealth: 'crashed',
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

    const buttons = collectButtons(element);

    expect(getButtonByLabel(buttons, 'Apply Solution')?.props.variant).toBe('tonal');
    expect(getButtonByLabel(buttons, 'Animate Solution')?.props.variant).toBe('tonal');
    expect(getButtonByLabel(buttons, 'Retry Worker')?.props.variant).toBe('secondary');
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
    const runButton = getButtonByLabel(runningButtons, 'Run Solve');
    const cancelButton = getButtonByLabel(runningButtons, 'Cancel');
    const pauseButton = getButtonByLabel(runningButtons, 'Pause');
    const stepBack = getButtonByLabel(runningButtons, 'Step Back');
    const stepForward = getButtonByLabel(runningButtons, 'Step Forward');

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
    const cancellingRun = getButtonByLabel(cancellingButtons, 'Run Solve');
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

    const select = findByElementType(element, 'select');

    expect(select).toBeDefined();
    expect(select?.props.value).toBe('1');

    select?.props.onChange({ target: { value: '3' } } as { target: { value: string } });
    select?.props.onChange({ target: { value: 'not-a-number' } } as { target: { value: string } });

    expect(speedCalls).toEqual([3]);
  });

  it('renders three named role=group button groups', () => {
    const html = renderToStaticMarkup(
      SolverControls({
        status: 'idle',
        replayState: 'idle',
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
      }),
    );

    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Solver run controls"');
    expect(html).toContain('aria-label="Solution actions"');
    expect(html).toContain('aria-label="Replay controls"');
  });

  it('marks step-back as aria-disabled when at the beginning and step-forward when at the end', () => {
    const atStart = renderToStaticMarkup(
      SolverControls({
        status: 'idle',
        replayState: 'paused',
        workerHealth: 'healthy',
        hasSolution: true,
        replayIndex: 0,
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
      }),
    );

    expect(atStart).toContain('>Step Back<');
    const stepBackMatch = atStart.match(/<button[^>]*>Step Back<\/button>/);
    expect(stepBackMatch?.[0]).toContain('aria-disabled="true"');

    const atEnd = renderToStaticMarkup(
      SolverControls({
        status: 'idle',
        replayState: 'paused',
        workerHealth: 'healthy',
        hasSolution: true,
        replayIndex: 3,
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
      }),
    );

    const stepForwardMatch = atEnd.match(/<button[^>]*>Step Forward<\/button>/);
    expect(stepForwardMatch?.[0]).toContain('aria-disabled="true"');
  });

  it('announces replay step counter via aria-live', () => {
    const html = renderToStaticMarkup(
      SolverControls({
        status: 'idle',
        replayState: 'paused',
        workerHealth: 'healthy',
        hasSolution: true,
        replayIndex: 2,
        replayTotalSteps: 5,
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
      }),
    );

    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="Replay step 2 of 5"');
    expect(html).toContain('Step 2 / 5');
  });
});
