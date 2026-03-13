import { createGame, parseLevel } from '@corgiban/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../canvas/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="lab-game-canvas-stub" />,
}));

import { LabPreviewPanel } from '../LabPreviewPanel';

const previewState = createGame(
  parseLevel({
    id: 'lab-temp-1',
    name: 'Temporary Lab Level',
    rows: ['WWWWW', 'WPBTW', 'WWWWW'],
  }),
);

describe('LabPreviewPanel', () => {
  it('renders preview guidance and cross-route handoff links', () => {
    const html = renderToStaticMarkup(
      <LabPreviewPanel
        previewState={previewState}
        playHref="/play?levelId=lab-temp-1"
        benchHref="/bench?levelId=lab-temp-1"
        onMove={() => undefined}
        onReset={() => undefined}
      />,
    );

    expect(html).toContain('Preview / Play');
    expect(html).toContain('Verify the authored board locally before you spend worker time on it.');
    expect(html).toContain('Reset preview');
    expect(html).toContain('Open in Play');
    expect(html).toContain('Send to Bench');
    expect(html).toContain('href="/play?levelId=lab-temp-1"');
    expect(html).toContain('href="/bench?levelId=lab-temp-1"');
  });
});
