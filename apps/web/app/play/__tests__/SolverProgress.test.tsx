import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { isValidElement } from 'react';

import type { SolverProgressProps } from '../SolverProgress';
import { SolverProgress } from '../SolverProgress';

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
    collectText(node.props.children, values);
  }

  return values;
}

function asText(node: ReactNode): string {
  return collectText(node).join(' ');
}

function renderWith(props: Partial<SolverProgressProps>) {
  return SolverProgress({
    status: props.status ?? 'idle',
    progress: props.progress ?? null,
    lastResult: props.lastResult ?? null,
    error: props.error ?? null,
  });
}

describe('SolverProgress', () => {
  it('maps each solver status to a user-facing status label', () => {
    const expectedLabels: Array<[SolverProgressProps['status'], string]> = [
      ['idle', 'Idle'],
      ['running', 'Running'],
      ['cancelling', 'Cancelling'],
      ['succeeded', 'Completed'],
      ['cancelled', 'Cancelled'],
      ['failed', 'Failed'],
    ];

    for (const [status, expectedLabel] of expectedLabels) {
      const element = renderWith({ status });
      expect(asText(element)).toContain(expectedLabel);
    }
  });

  it('renders solver progress metrics and rounds elapsed time', () => {
    const element = renderWith({
      status: 'running',
      progress: {
        runId: 'solve-1',
        expanded: 120,
        generated: 180,
        depth: 6,
        frontier: 15,
        elapsedMs: 12.6,
        bestHeuristic: 4,
      },
    });

    const text = asText(element);
    expect(text).toMatch(/\b13\s+ms\b/);
    expect(text).toContain('120');
    expect(text).toContain('180');
    expect(text).toContain('6');
    expect(text).toContain('15');
    expect(text).toContain('Best heuristic');
    expect(text).toContain('4');
  });

  it('renders last-result summary and surfaced solver errors', () => {
    const element = renderWith({
      status: 'failed',
      lastResult: {
        runId: 'solve-2',
        algorithmId: 'bfsPush',
        status: 'error',
        errorMessage: 'Solver failed.',
        metrics: {
          elapsedMs: 30,
          expanded: 50,
          generated: 90,
          maxDepth: 8,
          maxFrontier: 12,
          pushCount: 3,
          moveCount: 11,
        },
      },
      error: 'Solver crashed.',
    });

    const text = asText(element);
    expect(text).toContain('Last result:');
    expect(text).toContain('error');
    expect(text).toContain('Moves:');
    expect(text).toContain('11');
    expect(text).toContain('Pushes:');
    expect(text).toContain('3');
    expect(text).toContain('Expanded:');
    expect(text).toContain('50');
    expect(text).toContain('Generated:');
    expect(text).toContain('90');
    expect(text).toContain('Solver crashed.');
  });

  it('omits optional sections when progress, best heuristic, and result are absent', () => {
    const element = renderWith({
      status: 'idle',
      progress: {
        runId: 'solve-3',
        expanded: 1,
        generated: 2,
        depth: 0,
        frontier: 1,
        elapsedMs: 1,
      },
    });

    const text = asText(element);
    expect(text).not.toContain('Best heuristic');
    expect(text).not.toContain('Last result:');
  });

  it('falls back to the raw status value for unknown status labels', () => {
    const element = renderWith({
      status: 'queued' as unknown as SolverProgressProps['status'],
    });

    expect(asText(element)).toContain('queued');
  });
});
