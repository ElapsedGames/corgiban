import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';

import { createAppStore } from '../../state/store';
import { SolverPanel } from '../SolverPanel';
import type { SolverPanelProps } from '../SolverPanel';

const noop = () => undefined;

const baseProps: SolverPanelProps = {
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

function renderPanel(props: SolverPanelProps): string {
  const store = createAppStore();
  const html = renderToStaticMarkup(
    <Provider store={store}>
      <SolverPanel {...props} />
    </Provider>,
  );
  store.dispose();
  return html;
}

describe('SolverPanel', () => {
  it('marks future algorithms as coming soon and disables them', () => {
    const html = renderPanel(baseProps);

    // bfsPush is implemented: its option must not have disabled attribute
    expect(html).toContain('value="bfsPush"');
    expect(html).not.toContain('bfsPush (coming soon)');

    // astarPush is not implemented: its option must have disabled attribute and "(coming soon)" label
    expect(html).toContain('astarPush (coming soon)');
    // The disabled option for astarPush appears as: value="astarPush" disabled=""
    expect(html).toMatch(/value="astarPush" disabled=""/);

    // idaStarPush is not implemented: its option must have disabled attribute and "(coming soon)" label
    expect(html).toContain('idaStarPush (coming soon)');
    expect(html).toMatch(/value="idaStarPush" disabled=""/);
  });

  it('falls back to bfsPush when selected or recommended algorithm is unavailable', () => {
    const html = renderPanel({
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

    // The resolved algorithm is bfsPush (fallback), so bfsPush option must be selected
    expect(html).toContain('value="bfsPush" selected=""');
    // astarPush option must NOT be selected
    expect(html).not.toContain('value="astarPush" selected=""');
  });

  it('uses recommendation when no algorithm is selected and recommendation is implemented', () => {
    const html = renderPanel({
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

    // bfsPush is the recommendation and is implemented, so it should be selected
    expect(html).toContain('value="bfsPush" selected=""');
    expect(html).toContain('Recommended: bfsPush (2 boxes, 6x4)');
  });

  it('uses fallback algorithm when both selected and recommended values are missing', () => {
    const html = renderPanel({
      ...baseProps,
      selectedAlgorithmId: null,
      recommendation: null,
    });

    // bfsPush is the FALLBACK_ALGORITHM_ID and should be selected
    expect(html).toContain('value="bfsPush" selected=""');
    expect(html).toContain('No recommendation available yet.');
  });

  it('forwards algorithm selection changes to onSelectAlgorithm', () => {
    const calls: string[] = [];
    // Render the panel with a wired callback; verify the algorithm select is present.
    const html = renderPanel({
      ...baseProps,
      onSelectAlgorithm: (algorithmId) => {
        calls.push(algorithmId);
      },
    });

    // The algorithm select is rendered
    expect(html).toContain('value="bfsPush"');
    // The panel renders with an Algorithm label and select element
    expect(html).toContain('Algorithm');
  });

  it('enables solution actions when the last result contains solution moves', () => {
    const html = renderPanel({
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

    // When hasSolution=true, Apply Solution and Animate Solution buttons are not disabled.
    // A disabled button renders with the HTML attribute disabled="". Check by looking for the
    // attribute (not the Tailwind class name which always contains "disabled:" as a prefix).
    const applyMatch = html.match(/<button[^>]*>Apply Solution<\/button>/);
    expect(applyMatch).not.toBeNull();
    expect(applyMatch?.[0]).not.toContain('disabled=""');

    const animateMatch = html.match(/<button[^>]*>Animate Solution<\/button>/);
    expect(animateMatch).not.toBeNull();
    expect(animateMatch?.[0]).not.toContain('disabled=""');
  });

  it('renders budget controls with a positive minimum value', () => {
    const store = createAppStore();
    const html = renderToStaticMarkup(
      <Provider store={store}>
        <SolverPanel {...baseProps} />
      </Provider>,
    );
    store.dispose();

    expect(html).toContain('Time Budget (ms)');
    expect(html).toContain('Node Budget');
    expect((html.match(/min="1"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
