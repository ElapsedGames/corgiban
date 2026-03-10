import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type Ref,
} from 'react';

import type { GameState } from '@corgiban/core';

import {
  makeBoardSkinKey,
  resolveBoardPalette,
  DEFAULT_BOARD_SKIN_ID,
  type BoardRenderMode,
  type BoardSkinId,
} from './boardSkin';
import { buildRenderPlan } from './buildRenderPlan';
import { draw } from './draw';
import { getSpriteAtlas, releaseSpriteAtlas, retainSpriteAtlas } from './spriteAtlas.client';
import type { SpriteAtlas } from './spriteAtlas.types';
import { getDocumentTheme } from '../theme/theme';

export type GameCanvasProps = {
  state: GameState;
  cellSize?: number;
  className?: string;
  canvasRef?: Ref<HTMLCanvasElement>;
  skinId?: BoardSkinId;
  mode?: BoardRenderMode;
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

type DocumentLike = Pick<Document, 'documentElement'>;

type MutationObserverLike = {
  observe: (target: Node, options: MutationObserverInit) => void;
  disconnect: () => void;
};

type MutationObserverLikeCtor = new (callback: MutationCallback) => MutationObserverLike;

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

export function subscribeDocumentTheme(
  doc: DocumentLike | undefined,
  mutationObserverCtor: MutationObserverLikeCtor | undefined,
  onThemeChange: (next: BoardRenderMode) => void,
): () => void {
  const root = doc?.documentElement;
  if (!root) {
    return () => undefined;
  }

  const update = () => onThemeChange(getDocumentTheme(doc as Document));
  update();

  if (!mutationObserverCtor) {
    return () => undefined;
  }

  const observer = new mutationObserverCtor(() => update());
  observer.observe(root, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

export function renderCanvasFrame(
  canvas: CanvasLike | null,
  state: GameState,
  cellSize: number,
  dpr: number,
  atlas?: SpriteAtlas | null,
  mode: BoardRenderMode = 'dark',
  skinId: BoardSkinId = DEFAULT_BOARD_SKIN_ID,
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
  draw(ctx as CanvasRenderingContext2D, plan, atlas, resolveBoardPalette(skinId, mode));
}

function buildCanvasLabel(state: GameState): string {
  const { staticGrid } = state.level;
  const boxes = state.boxes;
  let remaining = 0;
  for (let i = 0; i < boxes.length; i++) {
    const idx = boxes[i];
    if (idx !== undefined && staticGrid[idx] !== 2) {
      remaining++;
    }
  }
  const total = boxes.length;
  return `Game board: ${remaining} of ${total} box${total === 1 ? '' : 'es'} remaining`;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) {
    return;
  }

  if (typeof ref === 'function') {
    ref(value);
    return;
  }

  (ref as MutableRefObject<T | null>).current = value;
}

export function GameCanvas({
  state,
  cellSize = 32,
  className,
  canvasRef: externalCanvasRef,
  skinId = DEFAULT_BOARD_SKIN_ID,
  mode,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const assignCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      canvasRef.current = node;
      assignRef(externalCanvasRef, node);
    },
    [externalCanvasRef],
  );
  const [dpr, setDpr] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [atlas, setAtlas] = useState<SpriteAtlas | null>(null);
  const [documentThemeMode, setDocumentThemeMode] = useState<BoardRenderMode>(() =>
    getDocumentTheme(typeof document === 'undefined' ? undefined : document),
  );
  const boardMode = mode ?? documentThemeMode;
  const responsiveCellSize = resolveResponsiveCellSize(state.level.width, cellSize, containerWidth);
  const activeAtlasKey = makeBoardSkinKey(skinId, boardMode, responsiveCellSize, dpr);

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
    if (mode) {
      return undefined;
    }

    return subscribeDocumentTheme(
      typeof document === 'undefined' ? undefined : document,
      typeof MutationObserver === 'undefined'
        ? undefined
        : (MutationObserver as unknown as MutationObserverLikeCtor),
      setDocumentThemeMode,
    );
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    let retainedAtlas: SpriteAtlas | null = null;

    void getSpriteAtlas(responsiveCellSize, dpr, skinId, boardMode).then((nextAtlas) => {
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
  }, [boardMode, dpr, responsiveCellSize, skinId]);

  useClientLayoutEffect(() => {
    const activeAtlas = atlas?.key === activeAtlasKey ? atlas : null;
    renderCanvasFrame(
      canvasRef.current as unknown as CanvasLike,
      state,
      responsiveCellSize,
      dpr,
      activeAtlas,
      boardMode,
      skinId,
    );
  }, [activeAtlasKey, atlas, boardMode, dpr, responsiveCellSize, skinId, state]);

  return (
    <canvas
      ref={assignCanvasRef}
      className={className}
      role="img"
      aria-label={buildCanvasLabel(state)}
    />
  );
}
