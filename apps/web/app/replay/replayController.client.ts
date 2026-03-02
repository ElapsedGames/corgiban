import { applyMove, createGame, undo } from '@corgiban/core';
import type { GameState, LevelRuntime } from '@corgiban/core';
import type { Direction } from '@corgiban/shared';

import type { AppDispatch } from '../state/store';
import { setReplayIndex, setReplayState, setReplayTotalSteps } from '../state/solverSlice';

export type Dispatch = AppDispatch;

export type ReplayControllerOptions = {
  level: LevelRuntime;
  dispatch: Dispatch;
  getReplaySpeed: () => number;
  baseStepMs?: number;
  raf?: (callback: (timestamp: number) => void) => number;
  caf?: (id: number) => void;
  onStateChange?: (state: GameState) => void;
};

const DEFAULT_STEP_MS = 120;

export class ReplayController {
  private readonly level: LevelRuntime;
  private readonly dispatch: Dispatch;
  private readonly getReplaySpeed: () => number;
  private readonly raf: (callback: (timestamp: number) => void) => number;
  private readonly caf: (id: number) => void;
  private readonly baseStepMs: number;
  private readonly onStateChange?: (state: GameState) => void;

  private replayMoves: Direction[] = [];
  private replayIndex = 0;
  private rafId: number | null = null;
  private lastTimestamp: number | null = null;
  private accumulatedMs = 0;
  private currentState: GameState;

  constructor(options: ReplayControllerOptions) {
    this.level = options.level;
    this.dispatch = options.dispatch;
    this.getReplaySpeed = options.getReplaySpeed;
    this.baseStepMs = options.baseStepMs ?? DEFAULT_STEP_MS;
    this.raf = options.raf ?? ((callback) => requestAnimationFrame(callback));
    this.caf = options.caf ?? ((id) => cancelAnimationFrame(id));
    this.onStateChange = options.onStateChange;
    this.currentState = createGame(this.level);
  }

  setMoves(moves: Direction[]): void {
    if (this.rafId !== null) {
      this.caf(this.rafId);
      this.rafId = null;
    }
    this.replayMoves = [...moves];
    this.replayIndex = 0;
    this.lastTimestamp = null;
    this.accumulatedMs = 0;
    this.currentState = createGame(this.level);
    this.dispatch(setReplayTotalSteps(this.replayMoves.length));
    this.dispatch(setReplayIndex(0));
    this.onStateChange?.(this.currentState);
  }

  start(): void {
    if (this.rafId !== null) {
      return;
    }
    this.dispatch(setReplayState('playing'));
    this.lastTimestamp = null;
    this.rafId = this.raf((timestamp) => this.handleFrame(timestamp));
  }

  pause(): void {
    if (this.rafId === null) {
      return;
    }
    this.caf(this.rafId);
    this.rafId = null;
    this.dispatch(setReplayState('paused'));
  }

  stop(): void {
    if (this.rafId !== null) {
      this.caf(this.rafId);
      this.rafId = null;
    }
    this.replayIndex = 0;
    this.lastTimestamp = null;
    this.accumulatedMs = 0;
    this.currentState = createGame(this.level);
    this.dispatch(setReplayIndex(0));
    this.dispatch(setReplayState('idle'));
    this.onStateChange?.(this.currentState);
  }

  stepForward(): void {
    if (this.replayIndex >= this.replayMoves.length) {
      return;
    }

    if (this.rafId !== null) {
      this.pause();
    }

    this.applyStep();

    const nextState = this.replayIndex >= this.replayMoves.length ? 'done' : 'paused';
    this.dispatch(setReplayState(nextState));
  }

  stepBack(): void {
    if (this.replayIndex <= 0) {
      return;
    }

    if (this.rafId !== null) {
      this.pause();
    } else {
      this.dispatch(setReplayState('paused'));
    }

    this.currentState = undo(this.currentState);
    this.replayIndex = Math.max(0, this.replayIndex - 1);
    this.dispatch(setReplayIndex(this.replayIndex));
    this.onStateChange?.(this.currentState);
  }

  getState(): GameState {
    return this.currentState;
  }

  private handleFrame(timestamp: number): void {
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
    }

    const delta = Math.min(timestamp - this.lastTimestamp, 250);
    this.lastTimestamp = timestamp;
    this.accumulatedMs += delta;

    const speed = this.getReplaySpeed();
    const stepMs = this.baseStepMs / Math.max(speed, 0.01);

    while (this.accumulatedMs >= stepMs && this.replayIndex < this.replayMoves.length) {
      this.applyStep();
      this.accumulatedMs -= stepMs;
    }

    if (this.replayIndex >= this.replayMoves.length) {
      this.rafId = null;
      this.dispatch(setReplayState('done'));
      return;
    }

    this.rafId = this.raf((nextTimestamp) => this.handleFrame(nextTimestamp));
  }

  private applyStep(): void {
    const move = this.replayMoves[this.replayIndex];
    // INVARIANT: solver solutions contain only legal moves, so applyMove always changes state.
    // TODO(Phase 2): when replaying arbitrary user history, avoid advancing on blocked moves.
    const result = applyMove(this.currentState, move);
    this.currentState = result.state;
    this.replayIndex += 1;
    this.dispatch(setReplayIndex(this.replayIndex));
    this.onStateChange?.(this.currentState);
  }
}
