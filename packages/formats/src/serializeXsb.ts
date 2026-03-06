import type { LevelDefinition } from '@corgiban/levels';

import { formatRowsToXsb } from './normalizeGrid';

export type SerializeXsbOptions = {
  includeTitleComment?: boolean;
};

export function serializeXsb(level: LevelDefinition, options: SerializeXsbOptions = {}): string {
  const header = options.includeTitleComment === false ? '' : `; ${level.name} (${level.id})\n`;

  const rows = formatRowsToXsb(level.rows).join('\n');
  return `${header}${rows}`;
}
