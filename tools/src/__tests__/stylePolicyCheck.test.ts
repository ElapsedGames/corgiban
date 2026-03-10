import { describe, expect, it } from 'vitest';

import {
  BOARD_SKIN_TS_PATH,
  STYLE_GUIDE_PATH,
  TAILWIND_CONFIG_PATH,
  TOKENS_CSS_PATH,
  detectStyleViolations,
  isStyleRelevantFile,
} from '../stylePolicyCheck';

describe('STYLE_GUIDE_PATH', () => {
  it('points to the web style guide', () => {
    expect(STYLE_GUIDE_PATH).toBe('apps/web/app/styles/README.md');
  });
});

describe('isStyleRelevantFile', () => {
  it('treats tokens.css as style-relevant', () => {
    expect(isStyleRelevantFile(TOKENS_CSS_PATH, ':root { --color-bg: #fff; }')).toBe(true);
  });

  it('treats tailwind.config.ts as style-relevant', () => {
    expect(isStyleRelevantFile(TAILWIND_CONFIG_PATH, 'export default {};')).toBe(true);
  });

  it('treats app components with Tailwind classes as style-relevant', () => {
    expect(
      isStyleRelevantFile(
        'apps/web/app/ui/Button.tsx',
        'export function Button() { return <button className="rounded-app-md bg-panel" />; }',
      ),
    ).toBe(true);
  });

  it('treats app components with raw color literals as style-relevant', () => {
    expect(
      isStyleRelevantFile(
        'apps/web/app/ui/Foo.tsx',
        'export function Foo() { return <div style={{ color: "#fff" }} />; }',
      ),
    ).toBe(true);
  });

  it('ignores non-style app files', () => {
    expect(
      isStyleRelevantFile(
        'apps/web/app/state/gameSlice.ts',
        'export const value = 1; export function reducer() { return value; }',
      ),
    ).toBe(false);
  });

  it('returns false for non-style file extensions', () => {
    expect(isStyleRelevantFile('apps/web/app/ui/README.md', '# Button docs')).toBe(false);
  });

  it('returns false for app test files', () => {
    expect(
      isStyleRelevantFile(
        'apps/web/app/ui/__tests__/Button.test.tsx',
        'export function ButtonTest() { return <div style={{ color: "#fff" }} />; }',
      ),
    ).toBe(false);
  });

  it('returns false for files outside apps/web/app/', () => {
    expect(
      isStyleRelevantFile(
        'packages/core/src/engine.ts',
        'export function render() { return <div className="bg-panel" />; }',
      ),
    ).toBe(false);
  });
});

describe('detectStyleViolations', () => {
  it('flags arbitrary token color utilities in components', () => {
    expect(
      detectStyleViolations(
        'apps/web/app/root.tsx',
        'const x = <div className="text-[color:var(--color-muted)]" />;',
      ),
    ).toContain('Use semantic Tailwind color utilities instead of arbitrary token color classes.');
  });

  it('flags arbitrary token radius utilities in components', () => {
    expect(
      detectStyleViolations(
        'apps/web/app/root.tsx',
        'const x = <div className="rounded-[var(--radius-md)]" />;',
      ),
    ).toContain(
      'Use semantic Tailwind radius utilities instead of arbitrary token radius classes.',
    );
  });

  it('flags direct CSS variable usage in components', () => {
    expect(
      detectStyleViolations(
        'apps/web/app/root.tsx',
        'const styles = { color: "var(--color-muted)" };',
      ),
    ).toContain(
      'Do not reference app color or radius CSS variables directly in components. Add or use a semantic Tailwind utility instead.',
    );
  });

  it('flags Tailwind radius overrides on sm/md/lg', () => {
    expect(
      detectStyleViolations(
        TAILWIND_CONFIG_PATH,
        'export default { theme: { extend: { borderRadius: { sm: "1rem" } } } };',
      ),
    ).toContain(
      'Do not override Tailwind core radius keys sm/md/lg. Add app-specific radius names instead.',
    );
  });

  it('flags raw colors in app.css and components but allows them in tokens.css', () => {
    expect(detectStyleViolations('apps/web/app/styles/app.css', '.x { color: #fff; }')).toContain(
      'Keep raw color literals in tokens.css only. Use tokens in app-shell CSS and components.',
    );
    expect(
      detectStyleViolations(
        'apps/web/app/ui/Foo.tsx',
        'export function Foo() { return <div style={{ color: "#fff" }} />; }',
      ),
    ).toContain(
      'Keep raw color literals in tokens.css only. Use tokens in app-shell CSS and components.',
    );
    expect(detectStyleViolations(TOKENS_CSS_PATH, ':root { --color-bg: #fff; }')).toHaveLength(0);
  });

  it('allows raw colors in the board skin registry exception', () => {
    expect(
      detectStyleViolations(
        BOARD_SKIN_TS_PATH,
        'export const skin = { light: { floor: "#fff", grid: "rgba(15, 23, 42, 0.12)" } };',
      ),
    ).toHaveLength(0);
  });

  it('does not mistake HTML entities for raw color literals', () => {
    expect(
      detectStyleViolations(
        'apps/web/app/ui/Foo.tsx',
        'export function Foo() { return <span aria-hidden="true">&#10003;</span>; }',
      ),
    ).not.toContain(
      'Keep raw color literals in tokens.css only. Use tokens in app-shell CSS and components.',
    );
  });
});
