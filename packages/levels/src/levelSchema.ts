export interface LevelDefinition {
  id: string;
  name: string;
  rows: string[];
  // null = no usable known solution (absent, empty, or failed validation).
  // undefined = field not present in source (pre-normalization only).
  knownSolution?: string | null;
}

// S = target + box, Q = target + player (parsing details, not new cell kinds).
const allowedRowTokens = new Set(['W', 'E', 'T', 'P', 'B', 'S', 'Q', ' ']);

export function normalizeKnownSolution(
  value: string | null | undefined,
): string | null | undefined {
  // Returns null for empty/invalid content; undefined only means the field was absent.
  // After normalization, invalid strings never yield undefined.
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (/\s/.test(trimmed)) {
    return null;
  }

  if (/[^UDLRudlr]/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function validateRowTokens(rows: string[]): void {
  rows.forEach((row, rowIndex) => {
    for (const token of row) {
      if (!allowedRowTokens.has(token)) {
        throw new Error(
          `Invalid token "${token}" in row ${rowIndex + 1}. Allowed: W,E,T,P,B,S,Q,space.`,
        );
      }
    }
  });
}

export function normalizeLevelDefinition(level: LevelDefinition): LevelDefinition {
  validateRowTokens(level.rows);
  return {
    ...level,
    knownSolution: normalizeKnownSolution(level.knownSolution),
  };
}
