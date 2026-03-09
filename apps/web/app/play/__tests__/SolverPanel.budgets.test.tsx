import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import type { ReactNode } from 'react';

const budgetState = vi.hoisted(() => ({
  inputsByLabel: new Map<string, Record<string, unknown>>(),
}));

vi.mock('../../ui/Input', () => ({
  Input: (props: Record<string, unknown>) => {
    const label = props.label;
    if (typeof label === 'string') {
      budgetState.inputsByLabel.set(label, props);
    }
    return <div data-testid={`input-${String(label ?? 'unknown')}`} />;
  },
}));

vi.mock('../../ui/Select', () => ({
  Select: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../SolverControls', () => ({
  SolverControls: () => <div data-testid="solver-controls-stub" />,
}));

vi.mock('../SolverProgress', () => ({
  SolverProgress: () => <div data-testid="solver-progress-stub" />,
}));

import { createAppStore } from '../../state/store';
import { SolverPanel } from '../SolverPanel';

const noop = () => undefined;

const baseProps = {
  recommendation: null,
  selectedAlgorithmId: 'bfsPush' as const,
  status: 'idle' as const,
  progress: null,
  lastResult: null,
  error: null,
  workerHealth: 'healthy' as const,
  replayState: 'idle' as const,
  replayIndex: 0,
  replayTotalSteps: 0,
  replaySpeed: 1,
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

function renderPanel(store = createAppStore()) {
  budgetState.inputsByLabel.clear();
  renderToStaticMarkup(
    <Provider store={store}>
      <SolverPanel {...baseProps} />
    </Provider>,
  );
  return store;
}

function triggerInputChange(label: string, value: string) {
  const input = budgetState.inputsByLabel.get(label);
  if (!input) {
    throw new Error(`Input not captured for label: ${label}`);
  }

  const onChange = input.onChange as ((event: { target: { value: string } }) => void) | undefined;
  if (!onChange) {
    throw new Error(`onChange handler missing for input: ${label}`);
  }

  onChange({ target: { value } });
}

describe('SolverPanel budget settings', () => {
  beforeEach(() => {
    budgetState.inputsByLabel.clear();
  });

  it('updates time budget with floored positive integers', () => {
    const store = renderPanel();
    triggerInputChange('Time Budget (ms)', '123.9');

    expect(store.getState().settings.solverTimeBudgetMs).toBe(123);
  });

  it('updates node budget with floored positive integers', () => {
    const store = renderPanel();
    triggerInputChange('Node Budget', '987.4');

    expect(store.getState().settings.solverNodeBudget).toBe(987);
  });

  it('keeps time budget unchanged when value is not numeric', () => {
    const store = renderPanel();
    const before = store.getState().settings.solverTimeBudgetMs;

    triggerInputChange('Time Budget (ms)', 'not-a-number');

    expect(store.getState().settings.solverTimeBudgetMs).toBe(before);
  });

  it('keeps node budget unchanged when value is zero', () => {
    const store = renderPanel();
    const before = store.getState().settings.solverNodeBudget;

    triggerInputChange('Node Budget', '0');

    expect(store.getState().settings.solverNodeBudget).toBe(before);
  });

  it('keeps node budget unchanged when value is negative', () => {
    const store = renderPanel();
    const before = store.getState().settings.solverNodeBudget;

    triggerInputChange('Node Budget', '-5');

    expect(store.getState().settings.solverNodeBudget).toBe(before);
  });

  it('normalizes tiny positive time budgets to a minimum of one', () => {
    const store = renderPanel();

    triggerInputChange('Time Budget (ms)', '0.4');

    expect(store.getState().settings.solverTimeBudgetMs).toBe(1);
  });

  it('keeps time budget unchanged when value is Infinity', () => {
    const store = renderPanel();
    const before = store.getState().settings.solverTimeBudgetMs;

    triggerInputChange('Time Budget (ms)', 'Infinity');

    expect(store.getState().settings.solverTimeBudgetMs).toBe(before);
  });
});
