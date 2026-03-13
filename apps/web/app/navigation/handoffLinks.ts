import type { AlgorithmId } from '@corgiban/solver';

type HandoffLevelTarget =
  | string
  | {
      levelId?: string | null;
      levelRef?: string | null;
      exactLevelKey?: string | null;
    };

function withSearch(pathname: string, params: Record<string, string | null | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (!value) {
      return;
    }
    searchParams.set(key, value);
  });

  const search = searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function resolveLevelTarget(target: HandoffLevelTarget): {
  levelId?: string | null;
  levelRef?: string | null;
  exactLevelKey?: string | null;
} {
  if (typeof target === 'string') {
    return { levelId: target };
  }

  return target;
}

export function buildPlayHref(target: HandoffLevelTarget, algorithmId?: AlgorithmId): string {
  const resolvedTarget = resolveLevelTarget(target);
  return withSearch('/play', {
    levelRef: resolvedTarget.levelRef,
    levelId: resolvedTarget.levelId,
    exactLevelKey: resolvedTarget.exactLevelKey,
    algorithmId,
  });
}

export function buildLabHref(target: HandoffLevelTarget): string {
  const resolvedTarget = resolveLevelTarget(target);
  return withSearch('/lab', {
    levelRef: resolvedTarget.levelRef,
    levelId: resolvedTarget.levelId,
    exactLevelKey: resolvedTarget.exactLevelKey,
  });
}

export function buildBenchHref(target: HandoffLevelTarget): string {
  const resolvedTarget = resolveLevelTarget(target);
  return withSearch('/bench', {
    levelRef: resolvedTarget.levelRef,
    levelId: resolvedTarget.levelId,
    exactLevelKey: resolvedTarget.exactLevelKey,
  });
}
