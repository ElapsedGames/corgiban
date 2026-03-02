export type RenderCell = {
  index: number;
  row: number;
  col: number;
  wall: boolean;
  target: boolean;
  box: boolean;
  player: boolean;
};

export type RenderPlan = {
  width: number;
  height: number;
  cellSize: number;
  dpr: number;
  pixelWidth: number;
  pixelHeight: number;
  cells: RenderCell[];
};

export type RenderPlanOptions = {
  cellSize?: number;
  dpr?: number;
};
