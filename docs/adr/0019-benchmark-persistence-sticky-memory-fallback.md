# ADR 0019: Benchmark persistence recovery via sticky memory-fallback mode

**Status:** Accepted
**Date:** 2026-03-05
**Deciders:** Corgiban maintainers

## Context

`/bench` persistence uses an IndexedDB-backed repository with in-memory fallback behavior.
After a repository failure, prior behavior could attempt to return to durable mode on later calls,
which made recovery semantics ambiguous and difficult to reason about from diagnostics.

Phase 6 follow-up work required choosing explicit recovery semantics for repository failures:

- keep retrying the repository automatically,
- queue writes and replay later, or
- enter a deterministic degraded mode until an explicit reset/reload.

## Decision

- Once repository interaction fails (`init`, `load`, `save`, `replace`, or `clear`), benchmark
  storage enters `memory-fallback` mode.
- `memory-fallback` is sticky for the current app lifetime (until page reload / storage recreation).
- While sticky fallback is active:
  - benchmark reads/writes operate on in-memory results only,
  - repository calls are skipped,
  - diagnostics keep reporting `repositoryHealth = "memory-fallback"`.
- Diagnostics copy makes this behavior explicit (`memory-fallback (sticky until reload)`).

## Consequences

**Positive:**

- Recovery behavior is deterministic and easy to explain.
- Avoids repeated repository retries that can spam warnings and add latency.
- Preserves bench usability even after persistence degradation.

**Negative:**

- Durable persistence does not auto-recover in-session after transient failures.
- Users need reload/reset to retry durable repository usage.
- Future write-back replay strategies remain deferred work.

## Alternatives considered

- Retry repository operations on every call and auto-return to durable mode.
- Keep a write-back queue and replay when repository health appears restored.
- Keep mixed behavior (sometimes durable, sometimes fallback) without sticky semantics.

## Rollout plan (if applicable)

- Apply sticky fallback behavior in `apps/web` benchmark storage adapter.
- Surface sticky fallback status in `/bench` diagnostics UI.
- Update architecture/project docs and contributing notes.

## Testing plan

- Unit tests verify sticky fallback after repository failures on save/load/replace/clear.
- Unit tests verify in-memory reads/writes continue while sticky fallback is active.
- UI diagnostics tests verify `memory-fallback` status and user-visible messaging.

## Links

- `docs/Architecture.md` (benchmark diagnostics/persistence sections)
- `docs/project-plan.md` (Phase 6 task 11)
- `apps/web/app/infra/persistence/benchmarkStorage.client.ts`
