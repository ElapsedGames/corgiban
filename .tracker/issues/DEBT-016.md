---
id: DEBT-016
title: Benchmark wall-clock timing inflated when tab is backgrounded
type: debt
severity: low
area: bench
regression: false
status: open
discovered_at: 2026-03-16
introduced_in: null
branch: null
pr: null
commit: null
owner: null
fixed_at: null
fixed_by: null
---

## Summary

The benchmark runner records `startedAtMs`/`finishedAtMs` using main-thread `Date.now()`
(`packages/benchmarks/src/runner/benchmarkRunner.ts:225`). When the user switches away from
the tab during a suite run, browser throttling stretches main-thread timer resolution to ~1 Hz,
inflating the outer wall-clock bracket. The solver's own `elapsedMs` (measured via
`performance.now()` inside the Web Worker) stays accurate, creating a mismatch between inner
and outer timing in stored `BenchmarkRunRecord`s.

No Page Visibility API usage exists anywhere in the codebase - there is no detection of
background state, no pause/resume of suites, and no user-facing warning.

## Expected

Benchmark wall-clock durations should reflect actual execution time, or the system should
warn/pause when the tab is backgrounded so stored results are not silently corrupted.

## Actual

Outer wall-clock durations are inflated by browser throttling when the tab is backgrounded.
Solver-internal `elapsedMs` remains correct but does not cover orchestration overhead captured
by the outer bracket.

## Repro

1. Open `/bench`, configure a suite, and start a run.
2. Switch to another browser tab and wait for the suite to finish.
3. Compare `elapsedMs` from solver metrics to `finishedAtMs - startedAtMs` in the stored record.
4. The outer bracket will be significantly larger than the inner solver time.

## Notes

- Web Workers themselves are NOT throttled in background tabs - the solver search runs at
  full speed. Only main-thread timers and callbacks are affected.
- `requestAnimationFrame` in the replay controller also drops to ~1 fps in background tabs,
  but that is cosmetic (replay pauses visually) and not a data integrity issue.
- Progress `postMessage` calls from worker to main thread queue up and arrive in a burst
  when the tab regains focus.

## Fix Plan

Options (not mutually exclusive):

1. **Warn**: detect `document.hidden` via Page Visibility API and show a banner when
   benchmarks are running in a backgrounded tab.
2. **Pause**: automatically pause the benchmark suite when the tab is hidden and resume
   when visible. Requires the runner to support pause/resume lifecycle.
3. **Worker-side timing**: move `startedAtMs`/`finishedAtMs` recording into the worker
   where `performance.now()` is not throttled. This fixes the data but not the UX stall.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
