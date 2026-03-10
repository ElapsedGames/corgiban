export const STYLE_GUIDE_PATH = 'apps/web/app/styles/README.md';
export const TOKENS_CSS_PATH = 'apps/web/app/styles/tokens.css';
export const BOARD_SKIN_TS_PATH = 'apps/web/app/canvas/boardSkin.ts';
export const TAILWIND_CONFIG_PATH = 'apps/web/tailwind.config.ts';

const styleCodeFilePattern = /\.(css|js|jsx|ts|tsx)$/;
const testFilePattern = /(?:^|\/)__tests__\/|\.(?:test|spec)\.(?:css|js|jsx|ts|tsx)$/;
const componentStyleSignalPattern =
  /className\s*=|className\s*:|rounded-|bg-|text-|border-|ring-|shadow-|font-/;

type PolicyRule = {
  message: string;
  pattern: RegExp;
};

const arbitraryTokenUtilityRules: PolicyRule[] = [
  {
    message: 'Use semantic Tailwind color utilities instead of arbitrary token color classes.',
    pattern: /(?:text|bg|border|ring|ring-offset)-\[(?:color:)?var\(--color-[^)]+\)\]/,
  },
  {
    message: 'Use semantic Tailwind radius utilities instead of arbitrary token radius classes.',
    pattern: /rounded-\[var\(--radius-[^)]+\)\]/,
  },
];

const componentCssVarRule: PolicyRule = {
  message:
    'Do not reference app color or radius CSS variables directly in components. Add or use a semantic Tailwind utility instead.',
  pattern: /var\(--(?:color|radius)-[A-Za-z0-9-]+\)/,
};

const rawColorLiteralRule: PolicyRule = {
  message:
    'Keep raw color literals in tokens.css only. Use tokens in app-shell CSS and components.',
  pattern: /(?<!&)#(?:[0-9a-fA-F]{3,8})\b|rgba?\s*\(/,
};

const tailwindRadiusOverrideRule: PolicyRule = {
  message:
    'Do not override Tailwind core radius keys sm/md/lg. Add app-specific radius names instead.',
  pattern: /borderRadius\s*:\s*{[\s\S]*?\b(?:sm|md|lg)\s*:/m,
};

function hasStylePolicySignal(content: string): boolean {
  return (
    componentStyleSignalPattern.test(content) ||
    componentCssVarRule.pattern.test(content) ||
    rawColorLiteralRule.pattern.test(content) ||
    arbitraryTokenUtilityRules.some((rule) => rule.pattern.test(content))
  );
}

export function isStyleRelevantFile(filePath: string, content: string): boolean {
  if (filePath === TAILWIND_CONFIG_PATH) {
    return true;
  }

  if (!styleCodeFilePattern.test(filePath)) {
    return false;
  }

  if (testFilePattern.test(filePath)) {
    return false;
  }

  if (filePath.startsWith('apps/web/app/styles/')) {
    return true;
  }

  if (!filePath.startsWith('apps/web/app/')) {
    return false;
  }

  return hasStylePolicySignal(content);
}

export function detectStyleViolations(filePath: string, content: string): string[] {
  const violations: string[] = [];

  for (const rule of arbitraryTokenUtilityRules) {
    if (rule.pattern.test(content)) {
      violations.push(rule.message);
    }
  }

  if (
    filePath.startsWith('apps/web/app/') &&
    !filePath.startsWith('apps/web/app/styles/') &&
    componentCssVarRule.pattern.test(content)
  ) {
    violations.push(componentCssVarRule.message);
  }

  if (
    filePath.startsWith('apps/web/app/') &&
    filePath !== TOKENS_CSS_PATH &&
    filePath !== BOARD_SKIN_TS_PATH &&
    rawColorLiteralRule.pattern.test(content)
  ) {
    violations.push(rawColorLiteralRule.message);
  }

  if (filePath === TAILWIND_CONFIG_PATH && tailwindRadiusOverrideRule.pattern.test(content)) {
    violations.push(tailwindRadiusOverrideRule.message);
  }

  return violations;
}
