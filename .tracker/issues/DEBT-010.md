---
id: DEBT-010
title: Tooltip overwrites aria-describedby instead of merging with existing value
type: debt
severity: low
area: ui
regression: false
status: fixed
discovered_at: 2026-03-06
introduced_in: null
branch: null
pr: null
commit: null
owner: null
fixed_at: 2026-03-06
fixed_by: null
---

## Summary

`apps/web/app/ui/Tooltip.tsx` uses `cloneElement(children, { 'aria-describedby': tooltipId })`
which silently overwrites any `aria-describedby` already on the trigger element. If a consumer
passes a trigger that already has its own `aria-describedby` (e.g. wired to an error message),
that association is lost.

## Expected

The Tooltip should merge its `tooltipId` with any existing `aria-describedby` value on the
trigger, producing a space-separated list of IDs per the ARIA spec.

## Actual

The existing `aria-describedby` on the trigger is overwritten by `tooltipId`, silently
dropping any previous descriptor association.

## Repro

1. Render `<Tooltip content="hint"><input aria-describedby="error-id" /></Tooltip>`
2. Inspect the rendered `input` - `aria-describedby` is `tooltipId` only; `error-id` is gone.

## Notes

Identified during DEBT-008 accessibility work. The fix was deferred from that task.

## Fix Plan

In `Tooltip.tsx`, read `children.props['aria-describedby']` and build a merged value:

```ts
const existing = children.props['aria-describedby'];
const merged = existing ? `${existing} ${tooltipId}` : tooltipId;
cloneElement(children, { 'aria-describedby': merged });
```

Add a test that verifies the merged output when the trigger already carries an
`aria-describedby` attribute.

## Resolution

- `apps/web/app/ui/Tooltip.tsx`: read `children.props['aria-describedby']` before
  calling `cloneElement`; when a value exists, build a space-separated merge
  (`"${existing} ${tooltipId}"`); otherwise use `tooltipId` alone.
- `apps/web/app/ui/__tests__/Tooltip.test.tsx`: added merge test - renders a trigger
  that already carries `aria-describedby="error-id"`, asserts both `error-id` and the
  tooltip id appear in the final attribute as two space-separated tokens, and that the
  tooltip element with the correct id is present in the markup.

## Verification

- [x] test added or updated
- [x] manual verification completed
- [-] docs updated if needed
