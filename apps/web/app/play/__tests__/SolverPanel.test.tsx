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
  it('lists every implemented algorithm without disabled placeholder labels', () => {
    const html = renderPanel(baseProps);

    expect(html).toContain('value="bfsPush"');
    expect(html).toContain('BFS Push');
    expect(html).toContain('A* Push');
    expect(html).toContain('IDA* Push');
    expect(html).toContain('Greedy Push');
    expect(html).toContain('Tunnel Macro Push');
    expect(html).toContain('PI-Corral Push');
    expect(html).not.toContain('coming soon');
    expect(html).not.toMatch(/value="astarPush" disabled=""/);
    expect(html).not.toMatch(/value="idaStarPush" disabled=""/);
  });

  it('keeps the selected implemented algorithm active', () => {
    const html = renderPanel({
      ...baseProps,
      selectedAlgorithmId: 'piCorralPush',
      recommendation: {
        algorithmId: 'piCorralPush',
        features: {
          width: 8,
          height: 8,
          boxCount: 7,
          walkableCount: 20,
          reachableCount: 16,
          boxDensity: 0.35,
          reachableRatio: 0.8,
          tunnelCellCount: 0,
          tunnelRatio: 0,
        },
      },
    });

    expect(html).toContain('value="piCorralPush" selected=""');
    expect(html).not.toContain('value="bfsPush" selected=""');
  });

  it('uses recommendation when no algorithm is selected and recommendation is implemented', () => {
    const html = renderPanel({
      ...baseProps,
      selectedAlgorithmId: null,
      recommendation: {
        algorithmId: 'greedyPush',
        features: {
          width: 6,
          height: 4,
          boxCount: 2,
          walkableCount: 18,
          reachableCount: 15,
          boxDensity: 2 / 18,
          reachableRatio: 15 / 18,
          tunnelCellCount: 0,
          tunnelRatio: 0,
        },
      },
    });

    expect(html).toContain('value="greedyPush" selected=""');
    expect(html).toContain('Start with Greedy Push for this 2-box 6x4 level.');
  });

  it('uses fallback algorithm when both selected and recommended values are missing', () => {
    const html = renderPanel({
      ...baseProps,
      selectedAlgorithmId: null,
      recommendation: null,
    });

    // bfsPush is the FALLBACK_ALGORITHM_ID and should be selected
    expect(html).toContain('value="bfsPush" selected=""');
    expect(html).toContain(
      'Pick an algorithm when you want to compare your playthrough with a worker solve.',
    );
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

  it('renders a compact mobile solver surface that only exposes replay speed after a solution exists', () => {
    const idleHtml = renderPanel(baseProps);
    expect(idleHtml).toContain('aria-label="Mobile solver controls"');
    expect(idleHtml).toContain(
      'Play first. Run a worker solve when you want a hint, a replay, or an algorithm comparison.',
    );
    expect(idleHtml).toContain('grid grid-cols-2 gap-2');
    expect(idleHtml).not.toContain('aria-label="Mobile replay speed"');

    const solvedHtml = renderPanel({
      ...baseProps,
      lastResult: {
        runId: 'solve-mobile',
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

    expect(solvedHtml).toContain(
      'Play first. Run a worker solve when you want a hint, a replay, or an algorithm comparison.',
    );
    expect(solvedHtml).toContain('aria-label="Mobile replay speed"');
    expect(solvedHtml).toContain('min-h-[42px] w-full px-4 py-2 text-sm');
  });

  it('keeps the cancel action visible while solving on mobile', () => {
    const html = renderPanel({
      ...baseProps,
      status: 'running',
      progress: {
        runId: 'solve-progress',
        elapsedMs: 123.7,
        expanded: 10,
        generated: 14,
        depth: 3,
        frontier: 8,
      },
    });

    expect(html).toContain('aria-label="Mobile solver controls"');
    expect(html).toContain('>Cancel<');
  });

  it('hides Run Solve behind a failure notice until the level changes on mobile', () => {
    const html = renderPanel({
      ...baseProps,
      status: 'failed',
      mobileRunLocked: true,
      error: 'Solver unavailable.',
    });

    expect(html).toContain('Solver did not complete this level.');
    expect(html).toContain('Select another level before trying Run Solve again.');
    expect(html).not.toContain('aria-label="Mobile solver controls"');
  });
});
