import type { AlgorithmInput, SolverAlgorithm } from '../api/algorithm';
import type { Push, SolveResult, SolverMetrics, SolverProgress } from '../api/solverTypes';
import { CLOCK_UNAVAILABLE_ERROR_MESSAGE, resolveNowMs } from '../api/clock';
import { createProgressReporter } from '../infra/progress';
import type { CancelToken } from '../infra/cancelToken';
import { VisitedSet } from '../infra/visited';
import { computeReachability } from '../infra/reachability';
import { DIRECTION_ORDER, globalIndexFromCell } from '../state/compiledLevel';
import {
  createInitialSolverState,
  createSolverState,
  fingerprintFromState,
} from '../state/solverState';
import { directionsToString, expandSolutionFromStart } from '../solution/expandSolution';

const OPPOSITE_DIR_INDEX = [1, 0, 3, 2];

type Node = {
  state: ReturnType<typeof createInitialSolverState>;
  parent: number;
  push?: Push;
  depth: number;
};

function isSolved(compiled: AlgorithmInput['compiled'], boxes: Uint16Array): boolean {
  if (boxes.length === 0) {
    return true;
  }
  for (let index = 0; index < boxes.length; index += 1) {
    if (!compiled.goals.has(boxes[index])) {
      return false;
    }
  }
  return true;
}

function buildMetrics(
  elapsedMs: number,
  expanded: number,
  generated: number,
  maxDepth: number,
  maxFrontier: number,
  pushCount: number,
  moveCount: number,
): SolverMetrics {
  return {
    elapsedMs,
    expanded,
    generated,
    maxDepth,
    maxFrontier,
    pushCount,
    moveCount,
  };
}

function buildProgress(
  expanded: number,
  generated: number,
  depth: number,
  frontier: number,
  elapsedMs: number,
): SolverProgress {
  return { expanded, generated, depth, frontier, elapsedMs };
}

function shouldCancel(token: CancelToken | undefined): boolean {
  return token ? token.isCancelled() : false;
}

export function solveBfsPush(input: AlgorithmInput): SolveResult {
  const { level, compiled, zobrist, options, hooks, context } = input;
  const nowMs = resolveNowMs(context);
  if (!nowMs) {
    return {
      status: 'error',
      metrics: buildMetrics(0, 0, 0, 0, 0, 0, 0),
      errorMessage: CLOCK_UNAVAILABLE_ERROR_MESSAGE,
    };
  }
  const startMs = nowMs();

  const reporter = createProgressReporter(hooks?.onProgress, {
    throttleMs: context.progressThrottleMs,
    minExpandedDelta: context.progressExpandedInterval,
  });

  const visited = new VisitedSet();
  const initialState = createInitialSolverState(level, compiled, zobrist);
  const queue: Node[] = [{ state: initialState, parent: -1, depth: 0 }];

  visited.add(initialState.hash, fingerprintFromState(initialState));

  let head = 0;
  let expanded = 0;
  let generated = 1;
  let maxDepth = 0;
  let maxFrontier = 1;

  if (isSolved(compiled, initialState.boxes)) {
    const elapsedMs = nowMs() - startMs;
    const metrics = buildMetrics(elapsedMs, expanded, generated, maxDepth, maxFrontier, 0, 0);
    reporter.flush(buildProgress(expanded, generated, 0, queue.length - head, elapsedMs));
    return { status: 'solved', solutionMoves: '', metrics };
  }

  while (head < queue.length) {
    if (shouldCancel(context.cancelToken)) {
      const elapsedMs = nowMs() - startMs;
      const metrics = buildMetrics(elapsedMs, expanded, generated, maxDepth, maxFrontier, 0, 0);
      reporter.flush(buildProgress(expanded, generated, maxDepth, queue.length - head, elapsedMs));
      return { status: 'cancelled', metrics };
    }

    const elapsedMs = nowMs() - startMs;
    if (options.timeBudgetMs !== undefined && elapsedMs >= options.timeBudgetMs) {
      const metrics = buildMetrics(elapsedMs, expanded, generated, maxDepth, maxFrontier, 0, 0);
      reporter.flush(buildProgress(expanded, generated, maxDepth, queue.length - head, elapsedMs));
      return { status: 'timeout', metrics };
    }

    if (options.nodeBudget !== undefined && expanded >= options.nodeBudget) {
      const metrics = buildMetrics(elapsedMs, expanded, generated, maxDepth, maxFrontier, 0, 0);
      reporter.flush(buildProgress(expanded, generated, maxDepth, queue.length - head, elapsedMs));
      return { status: 'timeout', metrics };
    }

    const node = queue[head];
    head += 1;
    expanded += 1;

    if (node.depth > maxDepth) {
      maxDepth = node.depth;
    }

    if (isSolved(compiled, node.state.boxes)) {
      const solutionPushes: Push[] = [];
      let cursor = head - 1;
      while (cursor > 0) {
        const current = queue[cursor];
        solutionPushes.push(current.push!);
        cursor = current.parent;
      }
      solutionPushes.reverse();

      const directions = expandSolutionFromStart(level, solutionPushes);
      const solutionMoves = directionsToString(directions);
      const finalElapsed = nowMs() - startMs;
      const solvedFrontier = queue.length - head;
      const metrics = buildMetrics(
        finalElapsed,
        expanded,
        generated,
        maxDepth,
        maxFrontier,
        solutionPushes.length,
        directions.length,
      );
      reporter.flush(buildProgress(expanded, generated, node.depth, solvedFrontier, finalElapsed));
      return { status: 'solved', solutionMoves, metrics };
    }

    const reachability = computeReachability(compiled, node.state.player, node.state.occupancy);

    for (let boxIndex = 0; boxIndex < node.state.boxes.length; boxIndex += 1) {
      const boxCellId = node.state.boxes[boxIndex];

      for (let dirIndex = 0; dirIndex < DIRECTION_ORDER.length; dirIndex += 1) {
        const pushFrom = compiled.neighbors[boxCellId * 4 + OPPOSITE_DIR_INDEX[dirIndex]];
        if (pushFrom < 0) {
          continue;
        }
        if (!reachability.reachable.has(pushFrom)) {
          continue;
        }

        const pushTo = compiled.neighbors[boxCellId * 4 + dirIndex];
        if (pushTo < 0) {
          continue;
        }
        if (node.state.occupancy.has(pushTo)) {
          continue;
        }
        if (compiled.deadSquares.has(pushTo)) {
          continue;
        }

        const updatedBoxes = node.state.boxes.slice();
        updatedBoxes[boxIndex] = pushTo;
        updatedBoxes.sort();

        const childState = createSolverState(compiled, boxCellId, updatedBoxes, zobrist);
        if (visited.checkAndAdd(childState.hash, fingerprintFromState(childState))) {
          continue;
        }

        const push: Push = {
          boxIndex: globalIndexFromCell(compiled, boxCellId),
          direction: DIRECTION_ORDER[dirIndex],
        };

        const child: Node = {
          state: childState,
          parent: head - 1,
          push,
          depth: node.depth + 1,
        };

        queue.push(child);
        generated += 1;
      }
    }

    const frontier = queue.length - head;
    if (frontier > maxFrontier) {
      maxFrontier = frontier;
    }

    reporter.report(buildProgress(expanded, generated, node.depth, frontier, elapsedMs));
  }

  const elapsedMs = nowMs() - startMs;
  const metrics = buildMetrics(elapsedMs, expanded, generated, maxDepth, maxFrontier, 0, 0);
  reporter.flush(buildProgress(expanded, generated, maxDepth, 0, elapsedMs));
  return { status: 'unsolved', metrics };
}

export const bfsPushAlgorithm: SolverAlgorithm = {
  id: 'bfsPush',
  solve: solveBfsPush,
};
