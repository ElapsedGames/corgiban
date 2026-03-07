---
id: DEBT-011
title: Tabs keyboard navigation relies on document-global tab ids
type: debt
severity: low
area: ui
regression: false
status: deferred
discovered_at: 2026-03-07
introduced_in: null
branch: null
pr: null
commit: null
owner: null
fixed_at: null
fixed_by: null
---

## Summary

`apps/web/app/ui/Tabs.tsx` currently derives tab and panel ids directly from `item.id` and uses
`document.getElementById(...)?.focus()` during arrow-key navigation. That works for the current
single-tablist usage, but it makes focus movement depend on document-global id uniqueness and on
the target tab already being mounted at the time of the key event. This is a hardening follow-up,
not a known Phase 6 product bug.

## Expected

Each `Tabs` instance should own instance-scoped ARIA ids and resolve focus within its own tablist
instead of querying the entire document by a shared id pattern.

## Actual

Keyboard navigation currently does:

- `id={\`tab-\${item.id}\`}`
- `aria-controls={\`panel-\${item.id}\`}`
- `document.getElementById(\`tab-\${target.item.id}\`)?.focus()`

If multiple `Tabs` instances reuse the same `item.id` values on one page, focus can resolve to
the wrong instance. If the selected tab is not mounted yet, focus can also be dropped.

## Repro

1. Render two `Tabs` instances on the same page, both using items such as `alpha`, `beta`, and
   `gamma`.
2. Focus the first tablist and press `ArrowRight`.
3. Observe that the follow-up focus lookup is document-global and can target whichever
   `id="tab-beta"` the browser returns first instead of the tab inside the active tablist.

## Notes

- Current implementation reference: `apps/web/app/ui/Tabs.tsx`
- The current app appears to use a single visible `Tabs` instance, so this is low severity and
  should not be treated as a Phase 6 blocker.
- The underlying issue is broader than `getElementById(...)`: ids are not namespaced per `Tabs`
  instance, so ARIA linkage can also collide across multiple tablists.

## Fix Plan

- Add an instance-scoped prefix via `useId()` so tab and panel ids are unique per `Tabs` mount.
- Replace `document.getElementById(...)` focus movement with refs or a query scoped to the current
  tablist container.
- Add a regression test rendering two `Tabs` instances with overlapping `item.id` values and
  assert arrow-key focus stays within the active instance.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
