import type { FileRecord } from './analyzeFiles';

const STATUS_LABEL: Record<string, string> = {
  P: 'pass',
  W: 'warn',
  F: 'fail',
};

/**
 * Format an array of FileRecords into a human-readable plain-text report.
 *
 * The report always includes:
 * - A generation timestamp header.
 * - A summary line with total record count.
 * - One line per record: relative path, line count, size status, and a
 *   time-usage marker when applicable.
 */
export function formatReport(records: FileRecord[], generatedAt: Date): string {
  const header = `Generated: ${generatedAt.toISOString()}`;
  const summary = `Records: ${records.length}`;

  if (records.length === 0) {
    return `${header}\n${summary}\n`;
  }

  const lines = records.map((record) => {
    const status = STATUS_LABEL[record.sizeStatus] ?? record.sizeStatus;
    const timeFlag = record.hasTimeUsage ? ' [time]' : '';
    return `  ${record.path} (${record.lines} lines, ${status})${timeFlag}`;
  });

  return `${header}\n${summary}\n\n${lines.join('\n')}\n`;
}
