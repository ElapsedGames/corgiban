import { createGame, parseLevel } from '@corgiban/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../canvas/GameCanvas', () => ({
  GameCanvas: ({ skinId }: { skinId: string }) => (
    <div data-testid="lab-game-canvas-stub" data-skin-id={skinId} />
  ),
}));

import { BoardSkinPreferenceProvider } from '../../canvas/useAppBoardSkin';
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
    expect(html).toContain('Check the parsed board here before spending worker time on it.');
    expect(html).toContain('Preview controls help');
    expect(html).toContain('Reset preview');
    expect(html).toContain('Open in Play');
    expect(html).toContain('Send to Bench');
    expect(html).toContain('href="/play?levelId=lab-temp-1"');
    expect(html).toContain('href="/bench?levelId=lab-temp-1"');
  });

  it('uses the shared board-skin preference for the lab preview canvas', () => {
    const html = renderToStaticMarkup(
      <BoardSkinPreferenceProvider boardSkinId="legacy">
        <LabPreviewPanel
          previewState={previewState}
          playHref="/play?levelId=lab-temp-1"
          benchHref="/bench?levelId=lab-temp-1"
          onMove={() => undefined}
          onReset={() => undefined}
        />
      </BoardSkinPreferenceProvider>,
    );

    expect(html).toContain('data-skin-id="legacy"');
  });
});
