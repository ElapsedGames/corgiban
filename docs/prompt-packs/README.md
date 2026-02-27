# Prompt Packs

A prompt pack is a single HTML file (based on `template.html`) that tracks one PR's worth of agent-driven work across phases. Each phase holds a scoped prompt, a status, and a copy button. The template is self-contained and runs directly in a browser with no build step.

---

## Creating a pack

Copy `template.html`, rename it using the pattern below, and fill in the placeholders.

## Pack completeness checklist (required)

A prompt pack is not acceptable unless all of the following are true:

- [ ] The phase Tasks are copied verbatim from `docs/project-plan.md`
- [ ] The phase Integration Proofs are copied verbatim from `docs/project-plan.md` (if any)
- [ ] A coverage map assigns every task and every proof to exactly one tab
- [ ] There are enough implementation tabs to keep work atomic:
      - 0-3 tasks: 1 implementation tab allowed
      - 4-7 tasks: 2-3 implementation tabs required
      - 8+ tasks: 3+ implementation tabs required
- [ ] A dedicated `Integration Proofs` tab exists when the phase lists integration proofs
- [ ] Every tab includes a file list (`create` and `modify`) so scope drift is visible
- [ ] Integration proofs include explicit commands and pass/fail criteria

### Naming pattern

```text
phase-NN-slug.html
```

- `NN` - zero-padded number matching the phase in `docs/project-plan.md` (00, 01, 02 ...)
- `slug` - short kebab-case description of the work

Examples:

```text
phase-00-scaffold.html
phase-01-core-engine.html
phase-02-worker-protocol.html
```

### Location rule

Always place packs in `docs/prompt-packs/`. Do not create a new folder. Do not place them at the repo root or anywhere else.

```text
docs/prompt-packs/
  template.html              <- base template, never fill this in directly
  phase-00-scaffold.html
  phase-01-core-engine.html
  ...
```

One file per PR.

---

## Phase structure

### Phase 1 - Planning (always first, no code)

- Output only: no file edits, no implementation.
- Produces a structured plan including:
  - verbatim phase Tasks and Integration Proofs from `docs/project-plan.md`
  - a coverage map assigning each task/proof to exactly one tab
  - per-tab file scope (`create` and `modify`) and acceptance criteria
- Every later phase references the acceptance criteria produced here.
- The agent must read `LLM_GUIDE.md`, `docs/Architecture.md`, and relevant package READMEs before producing this output.

### Implementation phases (middle)

- One logical unit of work per phase.
- Use enough implementation tabs to keep each tab atomic and reviewable (see checklist granularity rules).
- Each implementation phase must include:
  - **Context** - what this phase changes and why
  - **Tasks** - specific files and expected outcomes
  - **File scope** - exact files to create and modify for this tab
  - **Constraints** - the relevant boundary rule from `LLM_GUIDE.md section 4.2` pasted verbatim
  - **Local verification** - commands relevant to this tab plus expected pass/fail signals
  - **Not done until** footer - all three verification commands pass with no errors

### Integration Proofs tab (required when phase has proofs)

- Dedicated tab for phase Integration Proofs from `docs/project-plan.md`.
- Must include explicit validation commands and pass/fail criteria for each proof.
- Must document where proof outcomes are recorded in-repo.
- Cannot be merged into the generic Verification tab.

### Verification (always last, never modify)

- Generic - works for any prompt pack without changes.
- Run after all implementation phases and the Integration Proofs tab are green and verification commands pass.
- Confirms every acceptance criterion from Phase 1 is met and no scope drift occurred.

---

## Verification commands

Run before marking any implementation phase, the Integration Proofs phase, or the Verification phase complete:

```bash
pnpm typecheck
pnpm lint
pnpm test:coverage
```

All three must pass with no errors. A phase is not done until they do.

---

## Boundary rule quick reference

Paste the applicable rule from `LLM_GUIDE.md section 4.2` into the Constraints section of each implementation phase:

- `packages/core` imports only `shared` and `levels`
- `packages/solver` imports only `core` and `shared`
- `packages/worker` imports only `solver`, `core`, `shared`, and `benchmarks`
- `apps/web` imports packages through public entrypoints only

---

## Tab status workflow

- **Double-click** a tab to cycle status: Not Started (red) -> In Progress (yellow) -> Complete (green)
- Status persists in `localStorage` keyed by tab id
- The progress bar in the header reflects all current phase statuses at a glance
- **Copy Completed Prompts** (right end of the tab bar) collects all green-phase prompt text for batch review or audit

---

## Rules for agents using a prompt pack

1. Read the pack top to bottom before starting. Do not skip Phase 1.
2. Complete phases in order. Do not start Phase N+1 until Phase N acceptance criteria pass.
3. Do not modify the Verification phase content. It is intentionally generic.
4. Paste boundary constraints verbatim from `LLM_GUIDE.md` - do not paraphrase.
5. Do not mark a phase complete if any verification command fails.
6. Flag deviations from the Phase 1 file list before acting, not after.
7. Do not mark the pack complete until the coverage map accounts for every task and integration proof.