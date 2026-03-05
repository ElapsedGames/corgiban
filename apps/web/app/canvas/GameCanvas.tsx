import { useEffect, useRef, useState } from 'react';

import type { GameState } from '@corgiban/core';

import { buildRenderPlan } from './buildRenderPlan';
import { draw } from './draw';

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
  draw(ctx as CanvasRenderingContext2D, plan);
}

export function GameCanvas({ state, cellSize = 32, className }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    return subscribeDevicePixelRatio(
      typeof window === 'undefined' ? undefined : (window as WindowLike),
      setDpr,
    );
  }, []);

  useEffect(() => {
    renderCanvasFrame(canvasRef.current as unknown as CanvasLike, state, cellSize, dpr);
  }, [cellSize, dpr, state]);

  return <canvas ref={canvasRef} className={className} role="img" aria-label="Game board" />;
}
