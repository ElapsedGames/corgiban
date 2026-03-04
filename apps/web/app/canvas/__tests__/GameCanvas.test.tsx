import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { createGame, parseLevel } from '@corgiban/core';
import type { LevelDefinition } from '@corgiban/levels';

import { GameCanvas } from '../GameCanvas';

const level: LevelDefinition = {
  id: 'canvas-ssr',
  name: 'Canvas SSR',
  rows: ['WWWWW', 'WPEEW', 'WWWWW'],
};

describe('GameCanvas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders during SSR when window is not defined', () => {
    vi.stubGlobal('window', undefined as never);

    const state = createGame(parseLevel(level));
    const html = renderToStaticMarkup(<GameCanvas state={state} />);

    expect(html).toContain('canvas');
  });
});
