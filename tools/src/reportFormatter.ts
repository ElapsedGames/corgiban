import type { FileRecord } from './analyzeFiles';

export function formatReport(records: FileRecord[], generatedAt: Date): string {
  // tracked: DEBT-007
  return `Generated: ${generatedAt.toISOString()}\nRecords: ${records.length}\n`;
}
