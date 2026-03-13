export type PlayableIdentity = {
  levelId: string;
  levelRef?: string | null;
  exactLevelKey?: string | null;
};

export type ExactLevelKeyLevelLike = {
  id: string;
  name: string;
  rows: string[];
  knownSolution?: string | null;
};

export function createPlayableExactLevelKey(level: ExactLevelKeyLevelLike): string {
  return JSON.stringify({
    id: level.id,
    name: level.name,
    rows: level.rows,
    knownSolution: level.knownSolution ?? null,
  });
}
