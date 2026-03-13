import type { FileRecord } from './analyzeFiles';

export function formatReport(records: FileRecord[], generatedAt: Date): string {
  const warningFiles = records.filter((record) => record.sizeStatus === 'W');
  const failingFiles = records.filter((record) => record.sizeStatus === 'F');
  const timeUsageFiles = records.filter((record) => record.hasTimeUsage);

  const warningSection =
    warningFiles.length === 0
      ? '- None'
      : warningFiles.map((record) => `- ${record.path} (${record.lines} lines)`).join('\n');

  const failingSection =
    failingFiles.length === 0
      ? '- None'
      : failingFiles.map((record) => `- ${record.path} (${record.lines} lines)`).join('\n');

  const timeUsageSection =
    timeUsageFiles.length === 0
      ? '- None'
      : timeUsageFiles.map((record) => `- ${record.path}`).join('\n');

  return [
    '# Best Practices Report',
    '',
    `Generated: ${generatedAt.toISOString()}`,
    '',
    '## Legend',
    '',
    '- Pass: 500 lines or fewer',
    '- Warn: 501-800 lines',
    '- Fail: more than 800 lines',
    '',
    '## File Size Summary',
    '',
    `Scanned files: ${records.length}`,
    `Warning-sized files (501-800 lines): ${warningFiles.length}`,
    warningSection,
    '',
    `Fail-sized files (>800 lines): ${failingFiles.length}`,
    failingSection,
    '',
    '## Time Usage Summary',
    '',
    'Informational only. ESLint enforces Date and Date.now restrictions in packages/core and packages/solver.',
    timeUsageSection,
    '',
  ].join('\n');
}
