import type { LevelDefinition } from '@corgiban/levels';

import { formatRowsToXsb } from './normalizeGrid';

export type SerializeSok017Options = {
  includeTitleLine?: boolean;
};

export function serializeSok017(
  level: LevelDefinition,
  options: SerializeSok017Options = {},
): string {
  const titleLine = options.includeTitleLine === false ? '' : `Title: ${level.name}\n`;

  return `${titleLine}${formatRowsToXsb(level.rows).join('\n')}`;
}
