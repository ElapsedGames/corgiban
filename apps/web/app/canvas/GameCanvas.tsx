import { useEffect, useRef, useState } from 'react';

import type { GameState } from '@corgiban/core';

import { buildRenderPlan } from './buildRenderPlan';
import { draw } from './draw';
import { getSpriteAtlas, releaseSpriteAtlas, retainSpriteAtlas } from './spriteAtlas.client';
import type { SpriteAtlas } from './spriteAtlas.types';

export type GameCanvasProps = {
  state: GameState;
  cellSize?: number;
  className?: string;
};

type WindowLike = {
  devicePixelRatio?: number;
  addEventListener: (type: 'resize', listener: () => void) => void;
  removeEventListener: (type: 'resize', listener: () => void) => void;
};

type CanvasContextLike = Pick<CanvasRenderingContext2D, 'imageSmoothingEnabled'>;

type CanvasLike = {
  width: number;
  height: number;
  style: {
    width: string;
    height: string;
  };
  getContext: (contextId: '2d') => CanvasContextLike | null;
};

export function subscribeDevicePixelRatio(
  windowLike: WindowLike | undefined,
  onDprChange: (next: number) => void,
): () => void {
  if (!windowLike) {
    return () => undefined;
  }

  const update = () => onDprChange(windowLike.devicePixelRatio || 1);
  update();
  windowLike.addEventListener('resize', update);
  return () => windowLike.removeEventListener('resize', update);
}

export function renderCanvasFrame(
  canvas: CanvasLike | null,
  state: GameState,
  cellSize: number,
  dpr: number,
  atlas?: SpriteAtlas | null,
): void {
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const plan = buildRenderPlan(state, { cellSize, dpr });

  if (canvas.width !== plan.pixelWidth || canvas.height !== plan.pixelHeight) {
    canvas.width = plan.pixelWidth;
    canvas.height = plan.pixelHeight;
    canvas.style.width = `${plan.width * plan.cellSize}px`;
    canvas.style.height = `${plan.height * plan.cellSize}px`;
  }

  ctx.imageSmoothingEnabled = false;
  draw(ctx as CanvasRenderingContext2D, plan, atlas);
}

export function GameCanvas({ state, cellSize = 32, className }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dpr, setDpr] = useState(1);
  const [atlas, setAtlas] = useState<SpriteAtlas | null>(null);
  const activeAtlasKey = `${cellSize}:${dpr}`;

  useEffect(() => {
    return subscribeDevicePixelRatio(
      typeof window === 'undefined' ? undefined : (window as WindowLike),
      setDpr,
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retainedAtlas: SpriteAtlas | null = null;

    void getSpriteAtlas(cellSize, dpr).then((nextAtlas) => {
      if (cancelled) {
        return;
      }

      if (nextAtlas) {
        retainSpriteAtlas(nextAtlas);
        retainedAtlas = nextAtlas;
      }

      setAtlas(nextAtlas);
    });
    return () => {
      cancelled = true;
      releaseSpriteAtlas(retainedAtlas);
    };
  }, [cellSize, dpr]);

  useEffect(() => {
    const activeAtlas = atlas?.key === activeAtlasKey ? atlas : null;
    renderCanvasFrame(
      canvasRef.current as unknown as CanvasLike,
      state,
      cellSize,
      dpr,
      activeAtlas,
    );
  }, [activeAtlasKey, atlas, cellSize, dpr, state]);

  return <canvas ref={canvasRef} className={className} role="img" aria-label="Game board" />;
}
