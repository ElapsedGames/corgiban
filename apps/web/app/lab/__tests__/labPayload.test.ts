import { describe, expect, it } from 'vitest';

import {
  createLabPayload,
  LAB_PAYLOAD_TYPE,
  LAB_PAYLOAD_VERSION,
  parseLabPayload,
} from '../labPayload';

describe('labPayload', () => {
  it('parses valid payloads with only required fields', () => {
    const parsed = parseLabPayload(
      JSON.stringify({
        type: LAB_PAYLOAD_TYPE,
        version: LAB_PAYLOAD_VERSION,
        format: 'xsb',
        content: '#####\n#@$.#\n#####',
      }),
    );

    expect(parsed).toEqual({
      format: 'xsb',
      content: '#####\n#@$.#\n#####',
    });
  });

  it('parses valid payloads with optional exportedAtIso metadata', () => {
    const parsed = parseLabPayload(
      JSON.stringify({
        type: LAB_PAYLOAD_TYPE,
        version: LAB_PAYLOAD_VERSION,
        format: 'slc-xml',
        content: '<Collection />',
        exportedAtIso: '2026-03-06T12:34:56.000Z',
      }),
    );

    expect(parsed).toEqual({
      format: 'slc-xml',
      content: '<Collection />',
    });
  });

  it('creates export payloads using the documented contract', () => {
    expect(
      createLabPayload({
        format: 'corg',
        content: 'WWWW\nWPBW\nWETW\nWWWW',
        exportedAtIso: '2026-03-06T12:34:56.000Z',
      }),
    ).toEqual({
      type: LAB_PAYLOAD_TYPE,
      version: LAB_PAYLOAD_VERSION,
      format: 'corg',
      content: 'WWWW\nWPBW\nWETW\nWWWW',
      exportedAtIso: '2026-03-06T12:34:56.000Z',
    });
  });

  it('rejects payloads that are missing required fields or use invalid field types', () => {
    expect(() =>
      parseLabPayload(
        JSON.stringify({
          type: LAB_PAYLOAD_TYPE,
          version: LAB_PAYLOAD_VERSION,
          format: 'xsb',
        }),
      ),
    ).toThrow('Lab import payload is missing textual content.');

    expect(() =>
      parseLabPayload(
        JSON.stringify({
          type: LAB_PAYLOAD_TYPE,
          version: LAB_PAYLOAD_VERSION,
          format: 'xsb',
          content: '#####\n#@$.#\n#####',
          exportedAtIso: 123,
        }),
      ),
    ).toThrow('Lab import payload exportedAtIso must be a string when provided.');
  });

  it('rejects arrays and other non-object payload roots', () => {
    expect(() => parseLabPayload('[]')).toThrow('Lab import payload must be a JSON object.');
    expect(() => parseLabPayload('null')).toThrow('Lab import payload must be a JSON object.');
  });

  it('rejects unknown top-level fields to keep the v1 contract strict-closed', () => {
    expect(() =>
      parseLabPayload(
        JSON.stringify({
          type: LAB_PAYLOAD_TYPE,
          version: LAB_PAYLOAD_VERSION,
          format: 'xsb',
          content: '#####\n#@$.#\n#####',
          extra: true,
        }),
      ),
    ).toThrow('Lab import payload contains unsupported fields.');
  });
});
