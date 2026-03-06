import { afterEach, describe, expect, it, vi } from 'vitest';

describe('labFormat default fallback', () => {
  afterEach(() => {
    vi.doUnmock('@corgiban/levels');
    vi.resetModules();
  });

  it('returns a parseable fallback XSB level when builtin levels are empty', async () => {
    vi.doMock('@corgiban/levels', async () => {
      const actual = await vi.importActual<typeof import('@corgiban/levels')>('@corgiban/levels');
      return {
        ...actual,
        builtinLevels: [],
      };
    });

    const { defaultLabLevelText, parseLabInput } = await import('../labFormat');

    const text = defaultLabLevelText();
    const parsed = parseLabInput('xsb', text);

    expect(text).toContain('#.@ #');
    expect(text).toContain('# $ #');
    expect(parsed.level.rows.length).toBeGreaterThan(0);
    expect(parsed.normalizedFormat).toBe('xsb');
  });
});
