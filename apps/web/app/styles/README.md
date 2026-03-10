# Web Style Guide

This folder owns the app-wide styling contract for `apps/web`.

Use this guide when changing Tailwind classes, design tokens, app-shell CSS, or the style-policy
check that enforces this contract.

## Rules

1. Tokens are the source of truth.
   Put app-owned colors, radii, shadows, and theme values in `tokens.css`. Mirror those tokens in `apps/web/tailwind.config.ts`. Do not duplicate literal values in components. Narrow exception: worker-consumed board palettes may live in `apps/web/app/canvas/boardSkin.ts` because that render path cannot read CSS variables directly.

2. Use semantic Tailwind utilities in components.
   Prefer classes like `bg-panel`, `text-muted`, `border-border`, `text-error-text`, and `rounded-app-md`. Do not use Tailwind arbitrary-value escape hatches for app tokens such as `text-[color:var(--color-muted)]`, `border-[color:var(--color-border)]`, or `rounded-[var(--radius-md)]`.

3. Do not clobber Tailwind defaults.
   Tailwind core scales like `rounded-sm`, `rounded-md`, and `rounded-lg` keep their framework meaning. If the app needs token-backed radii, add app-specific names such as `rounded-app-sm`, `rounded-app-md`, and `rounded-app-lg`.

4. Semantic state colors beat raw palette classes.
   Repeated app states like success, warning, and error should use semantic tokens and utilities. Do not scatter `text-red-*`, `bg-amber-*`, `bg-emerald-*`, or similar classes through product components for shared states.

5. Dark mode belongs in the token layer.
   When a color is semantic, put the light and dark values in `tokens.css`. Do not duplicate `dark:` overrides across components for those semantic colors unless there is a genuinely local one-off exception.

6. Plain CSS is for shell/layout behavior, not token duplication.
   `app.css` should stay focused on app-shell structure, layout glue, and effects that do not fit cleanly in component utilities. Outside `tokens.css`, avoid raw hex, `rgb()`, and `rgba()` color literals in app CSS and app component code. The board-skin registry is the one documented TS-side exception for worker-safe render palettes.

7. Keep the UI kit honest.
   If you change shared primitives or the styling contract, verify `apps/web/app/routes/dev.ui-kit.tsx` still represents the intended design-system surface.

## Enforcement

- `pnpm style:check` runs `tools/scripts/style-policy-check.ts` against tracked files (`--all`) or
  staged files (default).
- Pre-commit runs the staged-file mode automatically.
- The check currently flags:
  - arbitrary token Tailwind classes such as `text-[color:var(--color-muted)]`
  - direct `var(--color-...)` / `var(--radius-...)` usage in app components
  - raw color literals outside `tokens.css` and the documented `boardSkin.ts` exception
  - overriding Tailwind core radius keys (`rounded-sm`, `rounded-md`, `rounded-lg`)

## Review Checklist

- Did the change add or update a token instead of hard-coding an app-wide value in a component?
- Did the component use a semantic utility instead of an arbitrary-value class?
- Did the change preserve Tailwind defaults instead of redefining them?
- Did dark-mode behavior stay centralized in tokens where possible?
- If raw color literals were introduced outside `tokens.css`, are they limited to the documented
  worker-safe board palette exception?
