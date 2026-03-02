import { describe, expect, it } from 'vitest';

import { parseLevel } from '@corgiban/core';
import type { LevelRuntime } from '@corgiban/core';

import type { Dispatch } from '../replayController.client';
import { ReplayController } from '../replayController.client';

function buildLevel(rows: string[]): LevelRuntime {
  return parseLevel({ id: 'test-level', name: 'Test Level', rows });
}

describe('ReplayController', () => {
  it('advances steps using RAF time accumulator', () => {
    const level = buildLevel(['WWWW', 'WPEW', 'WWWW']);
    const actions: Array<{ type: string; payload?: unknown }> = [];
    const callbacks: Array<(timestamp: number) => void> = [];
    const dispatch = ((action: unknown) => {
      actions.push(action as { type: string; payload?: unknown });
    }) as Dispatch;

    const controller = new ReplayController({
      level,
      dispatch,
      getReplaySpeed: () => 1,
      baseStepMs: 100,
      raf: (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      caf: () => undefined,
    });

    controller.setMoves(['R', 'L']);
    controller.start();

    callbacks.shift()?.(0);
    callbacks.shift()?.(100);
    callbacks.shift()?.(200);

    expect(actions).toEqual(
      expect.arrayContaining([{ type: 'solver/setReplayTotalSteps', payload: 2 }]),
    );

    const replayIndexPayloads = actions
      .filter((action) => action.type === 'solver/setReplayIndex')
      .map((action) => action.payload);

    expect(replayIndexPayloads).toEqual([0, 1, 2]);
    expect(actions.some((action) => action.type === 'solver/setReplayState')).toBe(true);
  });

  it('setMoves while playing cancels raf and resets timing', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WWWWW']);
    const actions: Array<{ type: string; payload?: unknown }> = [];
    const callbacks: Array<(timestamp: number) => void> = [];
    const cancelled: number[] = [];
    const dispatch = ((action: unknown) => {
      actions.push(action as { type: string; payload?: unknown });
    }) as Dispatch;

    const controller = new ReplayController({
      level,
      dispatch,
      getReplaySpeed: () => 1,
      baseStepMs: 100,
      raf: (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      caf: (id) => {
        cancelled.push(id);
      },
    });

    controller.setMoves(['R', 'L']);
    controller.start();

    callbacks.shift()?.(0);
    callbacks.shift()?.(90);

    controller.setMoves(['R']);

    expect(cancelled).toEqual([1]);

    callbacks.length = 0;

    controller.start();

    callbacks.shift()?.(1000);
    callbacks.shift()?.(1010);

    const replayIndexPayloads = actions
      .filter((action) => action.type === 'solver/setReplayIndex')
      .map((action) => action.payload);

    expect(replayIndexPayloads[replayIndexPayloads.length - 1]).toBe(0);

    callbacks.shift()?.(1100);

    const updatedReplayIndexPayloads = actions
      .filter((action) => action.type === 'solver/setReplayIndex')
      .map((action) => action.payload);

    expect(updatedReplayIndexPayloads[updatedReplayIndexPayloads.length - 1]).toBe(1);
  });

  it('clamps large timestamp deltas to avoid catch-up spikes', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WWWWW']);
    const actions: Array<{ type: string; payload?: unknown }> = [];
    const callbacks: Array<(timestamp: number) => void> = [];
    const dispatch = ((action: unknown) => {
      actions.push(action as { type: string; payload?: unknown });
    }) as Dispatch;

    const controller = new ReplayController({
      level,
      dispatch,
      getReplaySpeed: () => 1,
      baseStepMs: 50,
      raf: (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      caf: () => undefined,
    });

    controller.setMoves(['R', 'L', 'R', 'L', 'R', 'L', 'R', 'L', 'R', 'L']);
    controller.start();

    callbacks.shift()?.(0);
    callbacks.shift()?.(1000);

    const replayIndexPayloads = actions
      .filter((action) => action.type === 'solver/setReplayIndex')
      .map((action) => action.payload);

    expect(replayIndexPayloads[replayIndexPayloads.length - 1]).toBe(5);
    expect(
      actions.some(
        (action) => action.type === 'solver/setReplayState' && action.payload === 'done',
      ),
    ).toBe(false);
  });

  it('pauses, stops, and exposes the current state', () => {
    const level = buildLevel(['WWWW', 'WPEW', 'WWWW']);
    const actions: Array<{ type: string; payload?: unknown }> = [];
    const callbacks: Array<(timestamp: number) => void> = [];
    const cancelled: number[] = [];
    const dispatch = ((action: unknown) => {
      actions.push(action as { type: string; payload?: unknown });
    }) as Dispatch;

    const controller = new ReplayController({
      level,
      dispatch,
      getReplaySpeed: () => 1,
      baseStepMs: 100,
      raf: (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      caf: (id) => {
        cancelled.push(id);
      },
    });

    controller.pause();
    controller.setMoves(['R']);
    controller.start();
    controller.pause();
    controller.start();
    controller.stop();

    expect(cancelled).toEqual([1, 2]);
    expect(actions.some((action) => action.type === 'solver/setReplayState')).toBe(true);
    expect(controller.getState().playerIndex).toBe(level.initialPlayerIndex);
  });

  it('steps forward and backward manually', () => {
    const level = buildLevel(['WWWW', 'WPEW', 'WWWW']);
    const actions: Array<{ type: string; payload?: unknown }> = [];
    const dispatch = ((action: unknown) => {
      actions.push(action as { type: string; payload?: unknown });
    }) as Dispatch;

    const controller = new ReplayController({
      level,
      dispatch,
      getReplaySpeed: () => 1,
      baseStepMs: 100,
      raf: () => 1,
      caf: () => undefined,
    });

    controller.setMoves(['R']);
    controller.stepForward();

    expect(controller.getState().playerIndex).toBe(level.initialPlayerIndex + 1);
    expect(actions).toEqual(
      expect.arrayContaining([{ type: 'solver/setReplayIndex', payload: 1 }]),
    );

    controller.stepBack();

    expect(controller.getState().playerIndex).toBe(level.initialPlayerIndex);
    expect(actions).toEqual(
      expect.arrayContaining([{ type: 'solver/setReplayIndex', payload: 0 }]),
    );
  });

  it('steps back from done state to paused', () => {
    const level = buildLevel(['WWWW', 'WPEW', 'WWWW']);
    const actions: Array<{ type: string; payload?: unknown }> = [];
    const dispatch = ((action: unknown) => {
      actions.push(action as { type: string; payload?: unknown });
    }) as Dispatch;

    const controller = new ReplayController({
      level,
      dispatch,
      getReplaySpeed: () => 1,
      baseStepMs: 100,
      raf: () => 1,
      caf: () => undefined,
    });

    controller.setMoves(['R']);
    controller.stepForward();
    controller.stepBack();

    expect(actions).toEqual(
      expect.arrayContaining([{ type: 'solver/setReplayState', payload: 'paused' }]),
    );
  });

  it('steps forward from the start after stop', () => {
    const level = buildLevel(['WWWW', 'WPEW', 'WWWW']);
    const actions: Array<{ type: string; payload?: unknown }> = [];
    const dispatch = ((action: unknown) => {
      actions.push(action as { type: string; payload?: unknown });
    }) as Dispatch;

    const controller = new ReplayController({
      level,
      dispatch,
      getReplaySpeed: () => 1,
      baseStepMs: 100,
      raf: () => 1,
      caf: () => undefined,
    });

    controller.setMoves(['R']);
    controller.stop();
    controller.stepForward();

    const replayIndexPayloads = actions
      .filter((action) => action.type === 'solver/setReplayIndex')
      .map((action) => action.payload);

    expect(replayIndexPayloads).toEqual([0, 0, 1]);
  });
});
