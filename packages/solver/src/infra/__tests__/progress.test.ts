import { describe, expect, it } from 'vitest';

import { createProgressReporter } from '../progress';

function snapshot(expanded: number, elapsedMs: number) {
  return {
    expanded,
    generated: expanded,
    depth: 0,
    frontier: 0,
    elapsedMs,
  };
}

describe('createProgressReporter', () => {
  it('throttles progress and always flushes', () => {
    const events: number[] = [];
    const reporter = createProgressReporter((progress) => events.push(progress.expanded), {
      throttleMs: 50,
      minExpandedDelta: 5,
    });

    reporter.report(snapshot(0, 0));
    reporter.report(snapshot(1, 10));
    reporter.report(snapshot(4, 40));
    expect(events).toEqual([]);

    reporter.report(snapshot(5, 50));
    expect(events).toEqual([5]);

    reporter.report(snapshot(6, 70));
    expect(events).toEqual([5]);

    reporter.flush(snapshot(6, 70));
    expect(events).toEqual([5, 6]);
  });
});
