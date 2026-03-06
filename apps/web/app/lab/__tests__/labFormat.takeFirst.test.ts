import { afterEach, describe, expect, it, vi } from 'vitest';

describe('labFormat.takeFirst guard', () => {
  afterEach(() => {
    vi.doUnmock('@corgiban/formats');
    vi.resetModules();
  });

  it('throws when a format parser returns an empty level collection', async () => {
    const parseXsb = vi.fn(() => ({
      levels: [],
    }));

    vi.doMock('@corgiban/formats', () => ({
      parseXsb,
      parseSok017: vi.fn(),
      parseSlcXml: vi.fn(),
      serializeSok017: vi.fn(() => ''),
      serializeSlcXml: vi.fn(() => ''),
      serializeXsb: vi.fn(() => ''),
    }));

    const { parseLabInput } = await import('../labFormat');

    expect(() => parseLabInput('xsb', 'ignored input')).toThrow(
      'No levels were parsed from input.',
    );
    expect(parseXsb).toHaveBeenCalledWith('ignored input', { collectionId: 'lab' });
  });
});
