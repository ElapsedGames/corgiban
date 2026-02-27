import boundaries from 'eslint-plugin-boundaries';
import tsParser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';
import {
  ADAPTER_PERSISTENCE_RULE,
  DIRECTION_RULES,
  WORKER_CREATION_RULE,
} from './boundary-rules.mjs';

const webTypes = ['web', 'web-ui', 'web-routes', 'web-canvas', 'web-persistence'];

// elements is the only layer that stays manual: the web sub-types (web-ui,
// web-routes, web-canvas, web-persistence) are finer-grained than anything in
// DIRECTION_RULES and have no counterpart there. Everything else is derived.
const elements = [
  { type: 'shared', pattern: 'packages/shared/src/**' },
  { type: 'levels', pattern: 'packages/levels/src/**' },
  { type: 'core', pattern: 'packages/core/src/**' },
  { type: 'solver', pattern: 'packages/solver/src/**' },
  { type: 'worker', pattern: 'packages/worker/src/**' },
  { type: 'benchmarks', pattern: 'packages/benchmarks/src/**' },
  { type: 'web-persistence', pattern: 'apps/web/app/infra/persistence/**' },
  { type: 'web-ui', pattern: 'apps/web/app/ui/**' },
  { type: 'web-routes', pattern: 'apps/web/app/routes/**' },
  { type: 'web-canvas', pattern: 'apps/web/app/canvas/**' },
  { type: 'web', pattern: 'apps/web/app/**' },
];

// Map a boundary-rules.mjs glob to ESLint boundary type name(s).
// 'packages/X/src/**' -> 'X';  'apps/**' -> all web sub-types.
function globToEslintTypes(glob: string): string[] {
  const pkgMatch = glob.match(/^packages\/([^/]+)\//);
  if (pkgMatch) return [pkgMatch[1]];
  if (glob.startsWith('apps/')) return [...webTypes];
  return [];
}

// Derived from DIRECTION_RULES -- single source of truth with dependency-cruiser.
// To add a package or change an allowed direction, edit boundary-rules.mjs only.
const packageRules = DIRECTION_RULES.map((rule) => ({
  from: globToEslintTypes(rule.from)[0],
  disallow: rule.disallow.flatMap(globToEslintTypes),
}));

const adapterRule = {
  from: ['web-ui', 'web-routes', 'web-canvas'],
  disallow: ['web-persistence'],
};

// Generates MemberExpression selectors covering globalThis, window, and self
// variants of a banned identifier (e.g. window.SharedArrayBuffer).
function bannedGlobalMemberSelectors(
  name: string,
  message: string,
): Array<{ selector: string; message: string }> {
  return ['globalThis', 'window', 'self'].map((global) => ({
    selector: `MemberExpression[object.name='${global}'][property.name='${name}']`,
    message,
  }));
}

// Generates NewExpression selectors covering bare and globalThis/window/self
// variants of a constructor (e.g. new Worker(), new self.Worker()).
function bannedNewExpressionSelectors(
  name: string,
  message: string,
): Array<{ selector: string; message: string }> {
  return [
    { selector: `NewExpression[callee.name='${name}']`, message },
    ...['globalThis', 'window', 'self'].map((global) => ({
      selector: `NewExpression[callee.type='MemberExpression'][callee.object.name='${global}'][callee.property.name='${name}']`,
      message,
    })),
  ];
}

const bannedGlobalSelectors = [
  ...bannedGlobalMemberSelectors('SharedArrayBuffer', 'SharedArrayBuffer is banned in this repo.'),
  ...bannedGlobalMemberSelectors('Atomics', 'Atomics is banned in this repo.'),
];

const workerSelectors = [
  ...bannedNewExpressionSelectors('Worker', 'new Worker() is allowed only in *.client.ts modules.'),
  ...bannedNewExpressionSelectors(
    'SharedWorker',
    'new SharedWorker() is allowed only in *.client.ts modules.',
  ),
];

const dateSelectors = [
  ...bannedGlobalMemberSelectors(
    'Date',
    'Date is banned in core/solver. Use a deterministic time abstraction from @corgiban/shared.',
  ),
];

const packageSpecifiers = DIRECTION_RULES.map((rule) => ({
  files: [rule.from.replace('/**', '/**/*.{ts,tsx,js,jsx,mjs,cjs}')],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: rule.forbidSpecifiers ?? [],
      },
    ],
  },
}));

const adapterPersistenceSpecifiers = {
  files: ADAPTER_PERSISTENCE_RULE.adapterGlobs.map(
    (glob) => `${glob}/**/*.{ts,tsx,js,jsx,mjs,cjs}`,
  ),
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: ADAPTER_PERSISTENCE_RULE.forbidSpecifiers ?? [],
      },
    ],
  },
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-types/**',
      '**/build/**',
      '**/coverage/**',
      '**/artifacts/**',
      '**/docs/_generated/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      boundaries,
    },
    settings: {
      'boundaries/elements': elements,
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [...packageRules, adapterRule],
        },
      ],
      'no-restricted-globals': ['error', 'SharedArrayBuffer', 'Atomics'],
      'no-restricted-syntax': ['error', ...bannedGlobalSelectors, ...workerSelectors],
    },
  },
  {
    files: WORKER_CREATION_RULE.allowedGlobs,
    rules: {
      'no-restricted-syntax': ['error', ...bannedGlobalSelectors],
    },
  },
  {
    files: [
      'packages/core/src/**/*.{js,jsx,ts,tsx,mjs,cjs}',
      'packages/solver/src/**/*.{js,jsx,ts,tsx,mjs,cjs}',
    ],
    rules: {
      'no-restricted-globals': ['error', 'SharedArrayBuffer', 'Atomics', 'Date'],
      'no-restricted-syntax': [
        'error',
        ...bannedGlobalSelectors,
        ...workerSelectors,
        ...dateSelectors,
      ],
    },
  },
  ...packageSpecifiers,
  adapterPersistenceSpecifiers,
  eslintConfigPrettier,
];
