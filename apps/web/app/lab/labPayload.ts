import type { LabInputFormat } from './labFormat';

export const LAB_PAYLOAD_TYPE = 'corgiban-lab-level';
export const LAB_PAYLOAD_VERSION = 1;

const labPayloadKeys = new Set(['type', 'version', 'format', 'content', 'exportedAtIso']);

export type LabPayload = {
  type: typeof LAB_PAYLOAD_TYPE;
  version: typeof LAB_PAYLOAD_VERSION;
  format: LabInputFormat;
  content: string;
  exportedAtIso?: string;
};

export type ImportedLabPayload = Pick<LabPayload, 'format' | 'content'>;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyAllowedKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => labPayloadKeys.has(key));
}

function isLabInputFormat(value: unknown): value is LabInputFormat {
  return value === 'corg' || value === 'xsb' || value === 'sok-0.17' || value === 'slc-xml';
}

export function createLabPayload({
  format,
  content,
  exportedAtIso,
}: ImportedLabPayload & { exportedAtIso?: string }): LabPayload {
  return {
    type: LAB_PAYLOAD_TYPE,
    version: LAB_PAYLOAD_VERSION,
    format,
    content,
    ...(exportedAtIso === undefined ? {} : { exportedAtIso }),
  };
}

export function parseLabPayload(jsonText: string): ImportedLabPayload {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!isObjectRecord(parsed)) {
    throw new Error('Lab import payload must be a JSON object.');
  }

  if (!hasOnlyAllowedKeys(parsed)) {
    throw new Error('Lab import payload contains unsupported fields.');
  }

  if (parsed.type !== LAB_PAYLOAD_TYPE) {
    throw new Error('Unsupported lab import payload type.');
  }
  if (parsed.version !== LAB_PAYLOAD_VERSION) {
    throw new Error('Unsupported lab import payload version.');
  }
  if (!isLabInputFormat(parsed.format)) {
    throw new Error('Unsupported lab format in import payload.');
  }
  if (typeof parsed.content !== 'string') {
    throw new Error('Lab import payload is missing textual content.');
  }
  if (parsed.exportedAtIso !== undefined && typeof parsed.exportedAtIso !== 'string') {
    throw new Error('Lab import payload exportedAtIso must be a string when provided.');
  }

  return {
    format: parsed.format,
    content: parsed.content,
  };
}
