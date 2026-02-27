import { ADAPTER_PERSISTENCE_RULE, DIRECTION_RULES } from './boundary-rules.mjs';

const toRegex = (pattern) => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return `^${escaped.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')}`;
};

const directionRules = DIRECTION_RULES.map((rule) => ({
  name: `no-${rule.from.replace(/[^a-z0-9]+/gi, '-')}`,
  severity: 'error',
  from: {
    path: [toRegex(rule.from)],
  },
  to: {
    path: rule.disallow.map(toRegex),
  },
}));

const adapterRule = {
  name: 'no-adapter-to-persistence',
  severity: 'error',
  from: {
    path: ADAPTER_PERSISTENCE_RULE.adapterGlobs.map(toRegex),
  },
  to: {
    path: ADAPTER_PERSISTENCE_RULE.forbidPaths.map(toRegex),
  },
};

export default {
  forbidden: [...directionRules, adapterRule],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsConfig: {
      fileName: 'tsconfig.json',
    },
  },
};
