import type { AlgorithmInput, SolverAlgorithm } from '../api/algorithm';
import { CLOCK_UNAVAILABLE_ERROR_MESSAGE, resolveNowMs } from '../api/clock';
import type { Push, SolveResult } from '../api/solverTypes';
import { createProgressReporter } from '../infra/progress';
import { createInitialSolverState, fingerprintFromState } from '../state/solverState';
import { directionsToString, expandSolutionFromStart } from '../solution/expandSolution';
import {
  buildMetrics,
  buildProgress,
  estimateHeuristic,
  forEachPushChild,
  isSolved,
  shouldCancel,
} from './searchShared';

const FOUND_SENTINEL = -1;

type SearchFrame = {
  state: ReturnType<typeof createInitialSolverState>;
  depth: number;
};

function fingerprintsEqual(
  left: ReturnType<typeof fingerprintFromState>,
  right: ReturnType<typeof fingerprintFromState>,
): boolean {
  if (left.player !== right.player || left.boxes.length !== right.boxes.length) {
    return false;
  }

  for (let index = 0; index < left.boxes.length; index += 1) {
    if (left.boxes[index] !== right.boxes[index]) {
      return false;
    }
  }

  return true;
}

function hasState(
  path: SearchFrame[],
  state: ReturnType<typeof createInitialSolverState>,
): boolean {
  const fingerprint = fingerprintFromState(state);

  return path.some((frame) => fingerprintsEqual(fingerprintFromState(frame.state), fingerprint));
}

export function solveIdaStarPush(input: AlgorithmInput): SolveResult {
  const nowMs = resolveNowMs(input.context);
  if (!nowMs) {
    return {
      status: 'error',
      metrics: buildMetrics(0, 0, 0, 0, 0, 0, 0),
      errorMessage: CLOCK_UNAVAILABLE_ERROR_MESSAGE,
    };
  }

  const startMs = nowMs();
  const reporter = createProgressReporter(input.hooks?.onProgress, {
    throttleMs: input.context.progressThrottleMs,
    minExpandedDelta: input.context.progressExpandedInterval,
  });
  const weight = input.options.heuristicWeight ?? 1;
  const initialState = createInitialSolverState(input.level, input.compiled, input.zobrist);
  const initialHeuristic = estimateHeuristic(input, initialState.boxes);
  let threshold = initialHeuristic * weight;
  let expanded = 0;
  let generated = 1;
  let maxDepth = 0;
  let maxFrontier = 1;
  let bestHeuristic = initialHeuristic;
  let foundPushes: Push[] = [];

  if (isSolved(input.compiled, initialState.boxes)) {
    const elapsedMs = nowMs() - startMs;
    reporter.flush(buildProgress(expanded, generated, 0, 1, elapsedMs, initialHeuristic));
    return {
      status: 'solved',
      solutionMoves: '',
      metrics: buildMetrics(elapsedMs, expanded, generated, maxDepth, maxFrontier, 0, 0),
    };
  }

  const path: SearchFrame[] = [{ state: initialState, depth: 0 }];
  const pushPath: Push[] = [];
  let timedOut = false;
  let cancelled = false;

  const search = (state: ReturnType<typeof createInitialSolverState>, depth: number): number => {
    const elapsedMs = nowMs() - startMs;
    if (shouldCancel(input.context.cancelToken)) {
      cancelled = true;
      return FOUND_SENTINEL;
    }
    if (input.options.timeBudgetMs !== undefined && elapsedMs >= input.options.timeBudgetMs) {
      timedOut = true;
      return FOUND_SENTINEL;
    }
    if (input.options.nodeBudget !== undefined && expanded >= input.options.nodeBudget) {
      timedOut = true;
      return FOUND_SENTINEL;
    }

    const heuristic = estimateHeuristic(input, state.boxes);
    if (heuristic < bestHeuristic) {
      bestHeuristic = heuristic;
    }
    const score = depth + heuristic * weight;
    if (score > threshold) {
      return score;
    }

    expanded += 1;
    if (depth > maxDepth) {
      maxDepth = depth;
    }
    if (path.length > maxFrontier) {
      maxFrontier = path.length;
    }

    if (isSolved(input.compiled, state.boxes)) {
      foundPushes = [...pushPath];
      return FOUND_SENTINEL;
    }

    reporter.report(
      buildProgress(expanded, generated, depth, path.length, elapsedMs, bestHeuristic),
    );

    let minThreshold = Number.POSITIVE_INFINITY;

    forEachPushChild(input.compiled, state, input.zobrist, ({ state: childState, push }) => {
      if (cancelled || timedOut) {
        return;
      }
      if (hasState(path, childState)) {
        return;
      }

      generated += 1;
      path.push({ state: childState, depth: depth + 1 });
      pushPath.push(push);
      const candidateThreshold = search(childState, depth + 1);
      if (candidateThreshold === FOUND_SENTINEL) {
        minThreshold = FOUND_SENTINEL;
      } else if (candidateThreshold < minThreshold) {
        minThreshold = candidateThreshold;
      }
      pushPath.pop();
      path.pop();
    });

    return minThreshold;
  };

  while (true) {
    const nextThreshold = search(initialState, 0);

    if (cancelled) {
      const elapsedMs = nowMs() - startMs;
      reporter.flush(
        buildProgress(expanded, generated, maxDepth, path.length, elapsedMs, bestHeuristic),
      );
      return {
        status: 'cancelled',
        metrics: buildMetrics(elapsedMs, expanded, generated, maxDepth, maxFrontier, 0, 0),
      };
    }

    if (timedOut) {
      const elapsedMs = nowMs() - startMs;
      reporter.flush(
        buildProgress(expanded, generated, maxDepth, path.length, elapsedMs, bestHeuristic),
      );
      return {
        status: 'timeout',
        metrics: buildMetrics(elapsedMs, expanded, generated, maxDepth, maxFrontier, 0, 0),
      };
    }

    if (nextThreshold === FOUND_SENTINEL) {
      const directions = expandSolutionFromStart(input.level, foundPushes);
      const solutionMoves = directionsToString(directions);
      const elapsedMs = nowMs() - startMs;
      reporter.flush(
        buildProgress(expanded, generated, foundPushes.length, path.length, elapsedMs, 0),
      );
      return {
        status: 'solved',
        solutionMoves,
        metrics: buildMetrics(
          elapsedMs,
          expanded,
          generated,
          maxDepth,
          maxFrontier,
          foundPushes.length,
          directions.length,
        ),
      };
    }

    if (!Number.isFinite(nextThreshold)) {
      const elapsedMs = nowMs() - startMs;
      reporter.flush(buildProgress(expanded, generated, maxDepth, 0, elapsedMs, bestHeuristic));
      return {
        status: 'unsolved',
        metrics: buildMetrics(elapsedMs, expanded, generated, maxDepth, maxFrontier, 0, 0),
      };
    }

    threshold = nextThreshold;
  }
}

export const idaStarPushAlgorithm: SolverAlgorithm = {
  id: 'idaStarPush',
  solve: solveIdaStarPush,
};
