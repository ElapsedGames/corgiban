# ADR 0012: Replay pipeline shadow state and RAF scheduling

**Status:** Accepted
**Date:** 2026-03-01
**Deciders:** Corgiban maintainers

## Context

Solver solutions are replayed step-by-step in the UI. The replay state updates at
animation-frame cadence and uses typed arrays in `GameState`, which cannot be stored
in Redux (serializability rule). Without a clear contract, replay scheduling and
state ownership risk drifting into ad-hoc implementations.

## Decision

- Replay runs in a dedicated controller using `requestAnimationFrame` with a time
  accumulator (not `setInterval`).
- The replay `GameState` is held outside Redux as shadow state (for example, a `useRef`
  in a controller). Typed arrays are never stored in Redux.
- Redux stores only serializable replay metadata:
  - `replayState`, `replayIndex`, `replayTotalSteps`.
  - The move list is held in the replay controller's shadow state, not in Redux.
  - Replay speed is sourced from `settingsSlice.solverReplaySpeed`.
- When replay finishes, the user can apply the solution to `gameSlice` or dismiss it.

## Consequences

**Positive:**

- Redux state stays serializable and lightweight.
- Replay cadence is synced to the display refresh and pauses in background tabs.
- Playback remains deterministic and easy to test.

**Negative:**

- Adds a controller abstraction that must be wired into UI workflows.
- Replay state is split between Redux metadata and controller-owned shadow state.

## Alternatives considered

- Store full `GameState` in Redux (rejected: typed arrays and update frequency).
- Use `setInterval` for playback (rejected: poor sync with rendering, keeps running in background tabs).
- Apply replay steps directly to `gameSlice` (rejected: mixes preview with committed history).

## Rollout plan (if applicable)

- Implement a replay controller with RAF scheduling.
- Store replay metadata in `solverSlice`.
- Add unit tests for controller scheduling behavior.

## Testing plan

- Unit tests using a fake RAF to verify step timing and replay state changes.
- Reducer tests for replay metadata updates and resets.

## Links

- `docs/Architecture.md` sections 10.4 and 12
- `docs/project-plan.md` Phase 3
- `LLM_GUIDE.md` (serializable Redux state requirement)
