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

  it('reports when elapsed time threshold is met even if expanded delta is below threshold', () => {
    const events: number[] = [];
    const reporter = createProgressReporter((progress) => events.push(progress.expanded), {
      throttleMs: 50,
      minExpandedDelta: 10,
    });

    reporter.report(snapshot(0, 0));
    reporter.report(snapshot(1, 50));
    expect(events).toEqual([1]);

    reporter.report(snapshot(2, 70));
    expect(events).toEqual([1]);

    reporter.report(snapshot(3, 100));
    expect(events).toEqual([1, 3]);
  });

  it('reports when expanded threshold is met even if elapsed time delta is below threshold', () => {
    const events: number[] = [];
    const reporter = createProgressReporter((progress) => events.push(progress.expanded), {
      throttleMs: 100,
      minExpandedDelta: 5,
    });

    reporter.report(snapshot(0, 0));
    reporter.report(snapshot(5, 20));
    expect(events).toEqual([5]);

    reporter.report(snapshot(8, 50));
    expect(events).toEqual([5]);

    reporter.report(snapshot(10, 70));
    expect(events).toEqual([5, 10]);
  });

  it('is a no-op when onProgress is undefined', () => {
    const reporter = createProgressReporter(undefined, {
      throttleMs: 0,
      minExpandedDelta: 0,
    });

    expect(() => {
      reporter.report(snapshot(1, 1));
      reporter.flush(snapshot(2, 2));
    }).not.toThrow();
  });

  it('clamps negative throttle options to zero and emits immediately', () => {
    const events: number[] = [];
    const reporter = createProgressReporter((progress) => events.push(progress.expanded), {
      throttleMs: -10,
      minExpandedDelta: -5,
    });

    reporter.report(snapshot(0, 0));
    expect(events).toEqual([0]);
  });

  it('emits first report when expanded threshold is reached before elapsed threshold', () => {
    const events: number[] = [];
    const reporter = createProgressReporter((progress) => events.push(progress.expanded), {
      throttleMs: 100,
      minExpandedDelta: 3,
    });

    reporter.report(snapshot(2, 1));
    reporter.report(snapshot(3, 2));

    expect(events).toEqual([3]);
  });

  it('uses flush as the reporting baseline for subsequent throttling decisions', () => {
    const events: number[] = [];
    const reporter = createProgressReporter((progress) => events.push(progress.expanded), {
      throttleMs: 50,
      minExpandedDelta: 5,
    });

    reporter.flush(snapshot(10, 100));
    reporter.report(snapshot(12, 120));
    reporter.report(snapshot(15, 150));

    expect(events).toEqual([10, 15]);
  });

  it('flushes without a prior report call', () => {
    const events: number[] = [];
    const reporter = createProgressReporter((progress) => events.push(progress.expanded), {
      throttleMs: 100,
      minExpandedDelta: 100,
    });

    reporter.flush(snapshot(7, 30));
    expect(events).toEqual([7]);

    reporter.report(snapshot(8, 40));
    expect(events).toEqual([7]);
  });
});
