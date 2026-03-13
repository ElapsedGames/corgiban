# AnalyzeLevel Main-Thread Profile

This document is the repo-standard manual proof for `analyzeLevel(...)` browser-main-thread cost.
Use it when changing recommendation heuristics, `compileLevel(...)`, or route orchestration that
calls `analyzeLevel(...)` on `/play` or `/lab`.

## Preconditions

1. Build the production app: `pnpm build`
2. Start the preview server: `pnpm -C apps/web preview:cloudflare`
3. Keep the preview on the default `http://127.0.0.1:8788`, or pass a different base URL to the
   profiling script.

## Automated Trace Capture

Run:

```bash
pnpm profile:analyze-level:browser
```

Useful flags:

```bash
pnpm profile:analyze-level:browser -- --base-url http://127.0.0.1:43173 --cpu-throttle-rate 4
pnpm profile:analyze-level:browser -- --fixtures-only
```

The script writes local artifacts to `artifacts/analyze-level-browser-profile/`:

- `summary.md`
- `trace-report.md`
- `play-level-handoff.trace.json`
- `lab-run-solve.trace.json`
- `lab-run-bench.trace.json`
- `stress-level.corg.json`

`summary.md` records the heaviest built-in level selected by a Node-side sample pass, the exact
trace files captured, and the stress-fixture path. `trace-report.md` post-processes the generated
trace files into long-task and sampled-function summaries. Re-run it directly with:

```bash
pnpm profile:analyze-level:report
```

## Manual DevTools Follow-up

1. Open the `summary.md` artifact and note the selected built-in `levelId`.
2. In Chromium DevTools, set CPU throttling to `4x`.
3. Load `/play?levelId=<selected-level-id>`, record a Performance trace, and stop once the route is
   interactive.
4. Load `/lab?levelId=<selected-level-id>`, record a trace around `Run Solve`, then repeat for
   `Run Bench`.
5. Optional stress case: paste `artifacts/analyze-level-browser-profile/stress-level.corg.json`
   into `/lab`, click `Parse Level`, and capture the same `Run Solve` / `Run Bench` traces.

## What To Inspect

Search the main-thread flame chart for:

- `analyzeLevel`
- `compileLevel`
- `buildGoalDistances`

The question is whether the recommendation path is still comfortably below user-visible jank on
real route flows.

## Escalation Rule

- If the built-in trace shows `analyzeLevel(...)` repeatedly exceeding about one frame budget
  (`16ms`) under `4x` throttle, treat the debt as active.
- If the stack materially contributes to a `>50ms` long task, treat the debt as active even if the
  average case still looks acceptable.
- When the debt is active, prefer caching recommendation features per level or moving the heavier
  work off the main thread instead of expanding main-thread orchestration further.

## Notes

- The profiling script is a capture harness, not a correctness test.
- Keep findings with the active debt item (`.tracker/issues/DEBT-012.md`) or the relevant PR notes.
