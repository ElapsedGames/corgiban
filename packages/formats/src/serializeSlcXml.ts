import type { LevelDefinition } from '@corgiban/levels';

import { formatRowsToXsb } from './normalizeGrid';

export type SerializeSlcXmlOptions = {
  includeXmlDeclaration?: boolean;
};

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function serializeSlcXml(
  level: LevelDefinition,
  options: SerializeSlcXmlOptions = {},
): string {
  const rows = formatRowsToXsb(level.rows)
    .map((row) => `    <L>${escapeXml(row)}</L>`)
    .join('\n');
  const xmlDeclaration =
    options.includeXmlDeclaration === false ? '' : '<?xml version="1.0" encoding="UTF-8"?>\n';

  return `${xmlDeclaration}<Collection>
  <Level Id="${escapeXml(level.id)}" Name="${escapeXml(level.name)}">
${rows}
  </Level>
</Collection>`;
}
