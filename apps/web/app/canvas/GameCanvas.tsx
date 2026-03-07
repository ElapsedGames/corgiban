import { useEffect, useLayoutEffect, useRef, useState } from 'react';

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

type ParentElementLike = {
  clientWidth: number;
};

type CanvasLike = {
  width: number;
  height: number;
  parentElement?: ParentElementLike | null;
  style: {
    width: string;
    height: string;
    maxWidth?: string;
  };
  getContext: (contextId: '2d') => CanvasContextLike | null;
};

type ResizeObserverLike = {
  observe: (target: ParentElementLike) => void;
  disconnect: () => void;
};

type ResizeObserverLikeCtor = new (
  callback: (entries: ReadonlyArray<unknown>, observer: ResizeObserverLike) => void,
) => ResizeObserverLike;

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

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

export function resolveResponsiveCellSize(
  boardWidth: number,
  preferredCellSize: number,
  containerWidth?: number | null,
): number {
  if (
    !Number.isFinite(containerWidth) ||
    !containerWidth ||
    containerWidth <= 0 ||
    boardWidth <= 0
  ) {
    return preferredCellSize;
  }

  return Math.max(1, Math.min(preferredCellSize, Math.floor(containerWidth / boardWidth)));
}

export function subscribeContainerWidth(
  canvas: CanvasLike | null,
  windowLike: WindowLike | undefined,
  resizeObserverCtor: ResizeObserverLikeCtor | undefined,
  onWidthChange: (next: number) => void,
): () => void {
  const container = canvas?.parentElement;
  if (!container) {
    return () => undefined;
  }

  const update = () => onWidthChange(container.clientWidth);
  update();

  if (resizeObserverCtor) {
    const observer = new resizeObserverCtor(() => update());
    observer.observe(container);
    return () => observer.disconnect();
  }

  if (!windowLike) {
    return () => undefined;
  }

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
  const logicalWidth = `${plan.width * plan.cellSize}px`;

  if (canvas.width !== plan.pixelWidth || canvas.height !== plan.pixelHeight) {
    canvas.width = plan.pixelWidth;
    canvas.height = plan.pixelHeight;
  }

  canvas.style.width = logicalWidth;
  canvas.style.maxWidth = '100%';
  canvas.style.height = 'auto';

  ctx.imageSmoothingEnabled = false;
  draw(ctx as CanvasRenderingContext2D, plan, atlas);
}

export function GameCanvas({ state, cellSize = 32, className }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dpr, setDpr] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [atlas, setAtlas] = useState<SpriteAtlas | null>(null);
  const responsiveCellSize = resolveResponsiveCellSize(state.level.width, cellSize, containerWidth);
  const activeAtlasKey = `${responsiveCellSize}:${dpr}`;

  useEffect(() => {
    return subscribeDevicePixelRatio(
      typeof window === 'undefined' ? undefined : (window as WindowLike),
      setDpr,
    );
  }, []);

  useClientLayoutEffect(() => {
    return subscribeContainerWidth(
      canvasRef.current as unknown as CanvasLike,
      typeof window === 'undefined' ? undefined : (window as WindowLike),
      typeof ResizeObserver === 'undefined'
        ? undefined
        : (ResizeObserver as unknown as ResizeObserverLikeCtor),
      setContainerWidth,
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retainedAtlas: SpriteAtlas | null = null;

    void getSpriteAtlas(responsiveCellSize, dpr).then((nextAtlas) => {
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
  }, [responsiveCellSize, dpr]);

  useClientLayoutEffect(() => {
    const activeAtlas = atlas?.key === activeAtlasKey ? atlas : null;
    renderCanvasFrame(
      canvasRef.current as unknown as CanvasLike,
      state,
      responsiveCellSize,
      dpr,
      activeAtlas,
    );
  }, [activeAtlasKey, atlas, dpr, responsiveCellSize, state]);

  return <canvas ref={canvasRef} className={className} role="img" aria-label="Game board" />;
}
