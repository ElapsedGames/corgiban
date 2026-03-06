import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@corgiban/levels', async () => {
  const actual = await vi.importActual<typeof import('@corgiban/levels')>('@corgiban/levels');
  return {
    ...actual,
    builtinLevels: [],
  };
});

vi.mock('../../canvas/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="game-canvas-stub" />,
}));

import { LabPage } from '../LabPage';

describe('LabPage empty builtin fallback behavior', () => {
  it('renders a safe fallback level instead of throwing', () => {
    const html = renderToStaticMarkup(<LabPage />);

    expect(html).toContain('Level Lab');
    expect(html).toContain('Parsed successfully.');
    expect(html).toContain('XSB 1');
    expect(html).toContain('lab-001-level');
    expect(html).toContain('#.@ #');
    expect(html).toContain('# $ #');
  });
});
