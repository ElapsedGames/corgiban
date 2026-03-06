import type { LabInputFormat } from './labFormat';

export const LAB_PAYLOAD_TYPE = 'corgiban-lab-level';
export const LAB_PAYLOAD_VERSION = 1;

export function parseLabPayload(jsonText: string): { format: LabInputFormat; content: string } {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Lab import payload must be a JSON object.');
  }

  const payload = parsed as {
    type?: unknown;
    version?: unknown;
    format?: unknown;
    content?: unknown;
  };

  if (payload.type !== LAB_PAYLOAD_TYPE) {
    throw new Error('Unsupported lab import payload type.');
  }
  if (payload.version !== LAB_PAYLOAD_VERSION) {
    throw new Error('Unsupported lab import payload version.');
  }
  if (
    payload.format !== 'corg' &&
    payload.format !== 'xsb' &&
    payload.format !== 'sok-0.17' &&
    payload.format !== 'slc-xml'
  ) {
    throw new Error('Unsupported lab format in import payload.');
  }
  if (typeof payload.content !== 'string') {
    throw new Error('Lab import payload is missing textual content.');
  }

  return {
    format: payload.format,
    content: payload.content,
  };
}
