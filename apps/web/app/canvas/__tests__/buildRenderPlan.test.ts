import { describe, expect, it } from 'vitest';

import { applyMove, createGame, parseLevel } from '@corgiban/core';
import type { LevelDefinition } from '@corgiban/levels';

import { buildRenderPlan } from '../buildRenderPlan';

const level: LevelDefinition = {
  id: 'test-001',
  name: 'Test 1',
  rows: ['WWWWW', 'WEPBW', 'WETEW', 'WWWWW'],
};

describe('buildRenderPlan', () => {
  it('builds a deterministic render plan for a level', () => {
    const runtime = parseLevel(level);
    const state = createGame(runtime);
    const plan = buildRenderPlan(state, { cellSize: 20, dpr: 2 });

    expect(plan.width).toBe(5);
    expect(plan.height).toBe(4);
    expect(plan.pixelWidth).toBe(200);
    expect(plan.pixelHeight).toBe(160);
    expect(plan.cells).toHaveLength(20);
    expect(plan.cells[0]).toMatchObject({ index: 0, row: 0, col: 0, wall: true });
    expect(plan.cells[7]).toMatchObject({ index: 7, row: 1, col: 2, player: true });
    expect(plan.cells[8]).toMatchObject({ index: 8, row: 1, col: 3, box: true });
    expect(plan.cells[12]).toMatchObject({ index: 12, row: 2, col: 2, target: true });
  });

  it('updates player positions after a move', () => {
    const runtime = parseLevel(level);
    const state = createGame(runtime);
    const moved = applyMove(state, 'D');

    expect(moved.changed).toBe(true);

    const plan = buildRenderPlan(moved.state, { cellSize: 24 });
    expect(plan.cells[12]).toMatchObject({ player: true, target: true });
    expect(plan.cells[7]).toMatchObject({ player: false });
  });

  it('uses default render options when none are provided', () => {
    const runtime = parseLevel(level);
    const state = createGame(runtime);

    const plan = buildRenderPlan(state);

    expect(plan.cellSize).toBe(32);
    expect(plan.dpr).toBe(1);
    expect(plan.pixelWidth).toBe(160);
    expect(plan.pixelHeight).toBe(128);
  });
});
