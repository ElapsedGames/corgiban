import { describe, expect, it } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';

import { Select } from '../../ui/Select';
import { createAppStore } from '../../state/store';
import { SolverControls } from '../SolverControls';
import { SolverPanel } from '../SolverPanel';

type OptionElement = ReactElement<{ value: string; disabled?: boolean; children?: unknown }>;

function collectOptions(node: unknown, results: OptionElement[] = []) {
  if (!node) {
    return results;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectOptions(child, results));
    return results;
  }
  if (isValidElement<{ children?: unknown }>(node)) {
    if (node.type === 'option') {
      results.push(node as OptionElement);
    }
    collectOptions(node.props?.children, results);
  }
  return results;
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

function collectText(node: ReactNode, values: string[] = []) {
  if (typeof node === 'string' || typeof node === 'number') {
    values.push(String(node));
    return values;
  }
  if (!node) {
    return values;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, values));
    return values;
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    collectText(node.props?.children, values);
  }
  return values;
}

function asText(node: ReactNode): string {
  return collectText(node).join(' ');
}

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

describe('SolverPanel', () => {
  it('marks future algorithms as coming soon and disables them', () => {
    const element = SolverPanel(baseProps);
    const options = collectOptions(element);

    const bfs = options.find((option) => option.props.value === 'bfsPush');
    const astar = options.find((option) => option.props.value === 'astarPush');
    const ida = options.find((option) => option.props.value === 'idaStarPush');

    expect(bfs?.props.disabled).not.toBe(true);
    expect(astar?.props.disabled).toBe(true);
    expect(String(astar?.props.children)).toContain('coming soon');
    expect(ida?.props.disabled).toBe(true);
    expect(String(ida?.props.children)).toContain('coming soon');
  });

  it('falls back to bfsPush when selected or recommended algorithm is unavailable', () => {
    const element = SolverPanel({
      ...baseProps,
      selectedAlgorithmId: 'astarPush',
      recommendation: {
        algorithmId: 'astarPush',
        features: {
          width: 8,
          height: 8,
          boxCount: 7,
          walkableCount: 20,
          reachableCount: 16,
        },
      },
    });

    const select = findByType(element, Select);

    expect(select).toBeDefined();
    expect(select?.props.value).toBe('bfsPush');
  });

  it('uses recommendation when no algorithm is selected and recommendation is implemented', () => {
    const element = SolverPanel({
      ...baseProps,
      selectedAlgorithmId: null,
      recommendation: {
        algorithmId: 'bfsPush',
        features: {
          width: 6,
          height: 4,
          boxCount: 2,
          walkableCount: 18,
          reachableCount: 15,
        },
      },
    });

    const select = findByType(element, Select);

    expect(select).toBeDefined();
    expect(select?.props.value).toBe('bfsPush');
    expect(asText(element)).toContain('Recommended: bfsPush (2 boxes, 6x4)');
  });

  it('uses fallback algorithm when both selected and recommended values are missing', () => {
    const element = SolverPanel({
      ...baseProps,
      selectedAlgorithmId: null,
      recommendation: null,
    });
    const select = findByType(element, Select);

    expect(select).toBeDefined();
    expect(select?.props.value).toBe('bfsPush');
    expect(asText(element)).toContain('No recommendation available yet.');
  });

  it('forwards algorithm selection changes to onSelectAlgorithm', () => {
    const calls: string[] = [];
    const element = SolverPanel({
      ...baseProps,
      onSelectAlgorithm: (algorithmId) => {
        calls.push(algorithmId);
      },
    });

    const select = findByType(element, Select);
    expect(select).toBeDefined();

    select?.props.onChange({ target: { value: 'bfsPush' } } as {
      target: { value: string };
    });

    expect(calls).toEqual(['bfsPush']);
  });

  it('enables solution actions when the last result contains solution moves', () => {
    const element = SolverPanel({
      ...baseProps,
      lastResult: {
        runId: 'solve-1',
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
    });

    const controls = findByType(element, SolverControls);

    expect(controls).toBeDefined();
    expect(controls?.props.hasSolution).toBe(true);
    expect(controls?.props.replaySpeed).toBe(1);
  });

  it('renders budget controls with a positive minimum value', () => {
    const store = createAppStore();
    const html = renderToStaticMarkup(
      <Provider store={store}>
        <SolverPanel {...baseProps} />
      </Provider>,
    );
    store.dispose();

    expect(html).toContain('Default Time Budget (ms)');
    expect(html).toContain('Default Node Budget');
    expect((html.match(/min=\"1\"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
