# ADR 0030: App-local board skin registry

**Status:** Accepted
**Date:** 2026-03-10
**Deciders:** Corgiban maintainers

## Context

The board renderer now needs to satisfy three requirements at the same time:

- light/dark theme parity across the main-thread canvas fallback and the sprite-atlas worker
- one stable path for future alternate puzzle looks and sprite/image packs
- no dependency on DOM-only styling primitives inside worker-rendered paths

The previous approach duplicated board color literals across `draw.ts` and
`spriteAtlasWorker.client.ts`. That was easy to drift, and it would not scale cleanly to:

- theme-aware board rendering
- future skin ids
- worker-rendered sprite/image variants

CSS custom properties are not sufficient as the source of truth because worker code cannot read the
document token layer directly.

## Decision

- Keep board visual definitions app-local in `apps/web/app/canvas/boardSkin.ts`.
- Model board visuals with an explicit skin contract: `skinId` + render `mode` -> board palette.
- Use that shared TS data in both:
  - main-thread fallback rendering (`draw.ts`)
  - sprite-atlas worker generation (`spriteAtlasWorker.client.ts`)
- Treat this registry as the narrow documented exception to the web styling rule that normally
  keeps raw color literals in `tokens.css`; worker-consumed board palettes cannot read the DOM
  token layer directly.
- Thread `skinId` and `mode` through sprite-atlas request/ready messages and include both in atlas
  cache keys.
- Let `GameCanvas` default to the current document theme when no explicit render mode is passed.
- Keep this registry in `apps/web`, not in domain/shared packages. Board visuals remain an app
  adapter concern.
- Future sprite/image skins should extend the same app-local skin identity contract rather than
  introducing a second visual-source path.

## Consequences

**Positive:**

- Main-thread draw fallback and worker-generated atlases stay visually aligned.
- Light/dark board rendering is explicit instead of inferred from CSS inside workers.
- The board renderer can add new skins or sprite packs without changing route orchestration.
- Atlas caching stays correct when the board look changes because cache identity includes
  `skinId` and `mode`.

**Negative:**

- Visual tokens now exist in an app-local TS registry in addition to the shell token layer.
- Worker/message contracts for atlas generation are slightly wider because they carry visual
  identity explicitly.
- If shell tokens and board skins ever need to be unified, that will require an explicit bridge or
  generation step rather than direct CSS variable reads. That possible unification belongs in a
  later visual/rendering phase, not as an implicit styling-contract assumption in the current
  implementation.

## Alternatives considered

- Keep duplicated board color literals in each render path (rejected: drift risk and poor scaling).
- Drive board rendering directly from CSS custom properties (rejected: worker code cannot read the
  DOM token layer).
- Move board skins into a shared/domain package (rejected: board visuals are an app adapter concern,
  not a domain contract).

## Rollout plan

- Add `boardSkin.ts` as the app-local board-skin registry.
- Resolve palettes through that registry in `draw.ts` and the sprite-atlas worker.
- Extend atlas request/cache identity with `skinId` and `mode`.
- Keep the current `classic` procedural skin as the baseline; add future sprite/image variants on
  the same contract.

## Testing plan

- Unit-test skin resolution and cache-key generation.
- Verify `GameCanvas` tracks document theme changes and requests the correct atlas identity.
- Verify sprite-atlas request validation covers `skinId` and `mode`.
- Keep fallback renderer palette assertions aligned with the skin registry.

## Links

- `apps/web/app/canvas/boardSkin.ts`
- `apps/web/app/canvas/GameCanvas.tsx`
- `apps/web/app/canvas/draw.ts`
- `apps/web/app/canvas/spriteAtlas.types.ts`
- `apps/web/app/canvas/spriteAtlas.client.ts`
- `apps/web/app/canvas/spriteAtlasWorker.client.ts`
- `docs/Architecture.md`
- `apps/web/README.md`
