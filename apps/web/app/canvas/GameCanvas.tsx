import { useEffect, useRef, useState } from 'react';

import type { GameState } from '@corgiban/core';

import { buildRenderPlan } from './buildRenderPlan';
import { draw } from './draw';

export type GameCanvasProps = {
  state: GameState;
  cellSize?: number;
  className?: string;
};

export function GameCanvas({ state, cellSize = 32, className }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1);

  useEffect(() => {
    const update = () => setDpr(window.devicePixelRatio || 1);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
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
    draw(ctx, plan);
  }, [cellSize, dpr, state]);

  return <canvas ref={canvasRef} className={className} role="img" aria-label="Game board" />;
}
