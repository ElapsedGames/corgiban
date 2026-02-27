import type { FileRecord } from './analyzeFiles';

export function formatReport(records: FileRecord[], generatedAt: Date): string {
  return `Generated: ${generatedAt.toISOString()}\nRecords: ${records.length}\n`;
}
