import type { AlgorithmInput, SolverAlgorithm } from '../api/algorithm';
import { CLOCK_UNAVAILABLE_ERROR_MESSAGE, resolveNowMs } from '../api/clock';
import type { Push, SolveResult } from '../api/solverTypes';
import { createProgressReporter } from '../infra/progress';
import { zobristKeyToBigInt } from '../infra/zobrist';
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

type Node = {
  state: ReturnType<typeof createInitialSolverState>;
  parent: number;
  push?: Push;
  depth: number;
  heuristic: number;
  priority: number;
  serial: number;
};

type CostBucketEntry = {
  player: number;
  boxes: Uint16Array;
  cost: number;
};

class BinaryMinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly compare: (left: T, right: T) => number) {}

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): T | undefined {
    if (this.items.length === 0) {
      return undefined;
    }

    const first = this.items[0];
    const last = this.items.pop();
    if (last !== undefined && this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }

    return first;
  }

  private bubbleUp(index: number): void {
    let cursor = index;

    while (cursor > 0) {
      const parent = Math.floor((cursor - 1) / 2);
      if (this.compare(this.items[cursor], this.items[parent]) >= 0) {
        break;
      }

      [this.items[cursor], this.items[parent]] = [this.items[parent], this.items[cursor]];
      cursor = parent;
    }
  }

  private bubbleDown(index: number): void {
    let cursor = index;

    while (true) {
      const left = cursor * 2 + 1;
      const right = left + 1;
      let next = cursor;

      if (left < this.items.length && this.compare(this.items[left], this.items[next]) < 0) {
        next = left;
      }

      if (right < this.items.length && this.compare(this.items[right], this.items[next]) < 0) {
        next = right;
      }

      if (next === cursor) {
        break;
      }

      [this.items[cursor], this.items[next]] = [this.items[next], this.items[cursor]];
      cursor = next;
    }
  }
}

function buildWeightedPriority(depth: number, heuristic: number, weight: number): number {
  return depth + heuristic * weight;
}

function fingerprintsEqual(
  left: ReturnType<typeof fingerprintFromState>,
  right: CostBucketEntry,
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

function getRecordedCost(
  costs: Map<bigint, CostBucketEntry[]>,
  node: ReturnType<typeof createInitialSolverState>,
): number | undefined {
  const bucket = costs.get(zobristKeyToBigInt(node.hash));
  if (!bucket) {
    return undefined;
  }

  const fingerprint = fingerprintFromState(node);
  const entry = bucket.find((candidate) => fingerprintsEqual(fingerprint, candidate));
  return entry?.cost;
}

function recordCost(
  costs: Map<bigint, CostBucketEntry[]>,
  node: ReturnType<typeof createInitialSolverState>,
  cost: number,
): boolean {
  const bucketKey = zobristKeyToBigInt(node.hash);
  const fingerprint = fingerprintFromState(node);
  const bucket = costs.get(bucketKey);

  if (!bucket) {
    costs.set(bucketKey, [
      {
        player: fingerprint.player,
        boxes: Uint16Array.from(fingerprint.boxes),
        cost,
      },
    ]);
    return true;
  }

  for (const entry of bucket) {
    if (!fingerprintsEqual(fingerprint, entry)) {
      continue;
    }
    if (cost >= entry.cost) {
      return false;
    }

    entry.cost = cost;
    return true;
  }

  bucket.push({
    player: fingerprint.player,
    boxes: Uint16Array.from(fingerprint.boxes),
    cost,
  });
  return true;
}

function reconstructPushes(nodes: Node[], cursor: number): Push[] {
  const pushes: Push[] = [];

  while (cursor > 0) {
    const node = nodes[cursor];
    if (node.push) {
      pushes.push(node.push);
    }
    cursor = node.parent;
  }

  pushes.reverse();
  return pushes;
}

export function solveAstarPush(input: AlgorithmInput): SolveResult {
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
  const costs = new Map<bigint, CostBucketEntry[]>();
  const weight = input.options.heuristicWeight ?? 1;
  let serialCounter = 0;

  const initialState = createInitialSolverState(input.level, input.compiled, input.zobrist);
  const initialHeuristic = estimateHeuristic(input, initialState.boxes);
  const nodes: Node[] = [
    {
      state: initialState,
      parent: -1,
      depth: 0,
      heuristic: initialHeuristic,
      priority: buildWeightedPriority(0, initialHeuristic, weight),
      serial: serialCounter,
    },
  ];

  recordCost(costs, initialState, 0);

  const openSet = new BinaryMinHeap<number>((leftIndex, rightIndex) => {
    const left = nodes[leftIndex];
    const right = nodes[rightIndex];

    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    if (left.heuristic !== right.heuristic) {
      return left.heuristic - right.heuristic;
    }
    if (left.depth !== right.depth) {
      return left.depth - right.depth;
    }
    return left.serial - right.serial;
  });

  openSet.push(0);

  let expanded = 0;
  let generated = 1;
  let maxDepth = 0;
  let maxFrontier = 1;
  let bestFrontierHeuristic = initialHeuristic;

  if (isSolved(input.compiled, initialState.boxes)) {
    const elapsedMs = nowMs() - startMs;
    reporter.flush(
      buildProgress(expanded, generated, 0, openSet.size, elapsedMs, initialHeuristic),
    );
    return {
      status: 'solved',
      solutionMoves: '',
      metrics: buildMetrics(elapsedMs, expanded, generated, maxDepth, maxFrontier, 0, 0),
    };
  }

  while (openSet.size > 0) {
    if (shouldCancel(input.context.cancelToken)) {
      const elapsedMs = nowMs() - startMs;
      reporter.flush(
        buildProgress(
          expanded,
          generated,
          maxDepth,
          openSet.size,
          elapsedMs,
          bestFrontierHeuristic,
        ),
      );
      return {
        status: 'cancelled',
        metrics: buildMetrics(elapsedMs, expanded, generated, maxDepth, maxFrontier, 0, 0),
      };
    }

    const elapsedMs = nowMs() - startMs;
    if (input.options.timeBudgetMs !== undefined && elapsedMs >= input.options.timeBudgetMs) {
      reporter.flush(
        buildProgress(
          expanded,
          generated,
          maxDepth,
          openSet.size,
          elapsedMs,
          bestFrontierHeuristic,
        ),
      );
      return {
        status: 'timeout',
        metrics: buildMetrics(elapsedMs, expanded, generated, maxDepth, maxFrontier, 0, 0),
      };
    }

    if (input.options.nodeBudget !== undefined && expanded >= input.options.nodeBudget) {
      reporter.flush(
        buildProgress(
          expanded,
          generated,
          maxDepth,
          openSet.size,
          elapsedMs,
          bestFrontierHeuristic,
        ),
      );
      return {
        status: 'timeout',
        metrics: buildMetrics(elapsedMs, expanded, generated, maxDepth, maxFrontier, 0, 0),
      };
    }

    const currentIndex = openSet.pop();
    if (currentIndex === undefined) {
      break;
    }

    const current = nodes[currentIndex];
    const recordedCost = getRecordedCost(costs, current.state);
    if (recordedCost !== undefined && current.depth > recordedCost) {
      continue;
    }

    expanded += 1;
    if (current.depth > maxDepth) {
      maxDepth = current.depth;
    }

    if (isSolved(input.compiled, current.state.boxes)) {
      const pushes = reconstructPushes(nodes, currentIndex);
      const directions = expandSolutionFromStart(input.level, pushes);
      const solutionMoves = directionsToString(directions);
      const finalElapsedMs = nowMs() - startMs;
      reporter.flush(
        buildProgress(
          expanded,
          generated,
          current.depth,
          openSet.size,
          finalElapsedMs,
          current.heuristic,
        ),
      );
      return {
        status: 'solved',
        solutionMoves,
        metrics: buildMetrics(
          finalElapsedMs,
          expanded,
          generated,
          maxDepth,
          Math.max(maxFrontier, openSet.size),
          pushes.length,
          directions.length,
        ),
      };
    }

    forEachPushChild(input.compiled, current.state, input.zobrist, ({ state, push }) => {
      const nextDepth = current.depth + 1;
      if (!recordCost(costs, state, nextDepth)) {
        return;
      }

      const heuristic = estimateHeuristic(input, state.boxes);
      serialCounter += 1;
      nodes.push({
        state,
        parent: currentIndex,
        push,
        depth: nextDepth,
        heuristic,
        priority: buildWeightedPriority(nextDepth, heuristic, weight),
        serial: serialCounter,
      });
      openSet.push(nodes.length - 1);
      generated += 1;
      if (heuristic < bestFrontierHeuristic) {
        bestFrontierHeuristic = heuristic;
      }
    });

    if (openSet.size > maxFrontier) {
      maxFrontier = openSet.size;
    }

    reporter.report(
      buildProgress(
        expanded,
        generated,
        current.depth,
        openSet.size,
        elapsedMs,
        bestFrontierHeuristic,
      ),
    );
  }

  const elapsedMs = nowMs() - startMs;
  reporter.flush(buildProgress(expanded, generated, maxDepth, 0, elapsedMs, bestFrontierHeuristic));
  return {
    status: 'unsolved',
    metrics: buildMetrics(elapsedMs, expanded, generated, maxDepth, maxFrontier, 0, 0),
  };
}

export const astarPushAlgorithm: SolverAlgorithm = {
  id: 'astarPush',
  solve: solveAstarPush,
};
