export interface LevelRuntime {
  levelId: string;
  width: number;
  height: number;
  staticGrid: Uint8Array;
  initialPlayerIndex: number;
  initialBoxes: Uint32Array;
}
