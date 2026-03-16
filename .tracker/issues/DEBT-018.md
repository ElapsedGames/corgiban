---
id: DEBT-018
title: No protocol-level SOLVE_CANCEL or BENCH_CANCEL messages
type: debt
severity: low
area: worker
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

The worker protocol defines no `SOLVE_CANCEL` or `BENCH_CANCEL` inbound message types.
Cancellation is handled asymmetrically: the solver client terminates and recreates the entire
worker (`solverClient.client.ts`), while the benchmark client uses queue filtering and a
generation counter (`workerPool.client.ts`). Neither approach can interrupt a solve mid-search.

## Expected

A protocol-level cancel message would allow graceful in-flight cancellation without worker
termination, reducing overhead and enabling partial-result recovery.

## Actual

Solver cancel = worker termination + recreation. Benchmark cancel = queue drain + ignore
in-flight callbacks. No way to interrupt an active solve.

## Notes

The protocol schema already supports `status: 'cancelled'` in result messages, but nothing
currently triggers it from the host side.

## Fix Plan

Requires a protocol version bump. Add `SOLVE_CANCEL { runId }` and `BENCH_CANCEL { runId }`
inbound message types, wire a `CancelToken` check into the solver expansion loop, and return
a `cancelled` result with partial metrics. Revisit only if the terminate-and-recreate approach
causes measurable UX issues.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
