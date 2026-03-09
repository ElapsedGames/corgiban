export type ParseState = {
  message: string;
  isError: boolean;
  levelName: string;
  levelId: string;
};

export type SolveState =
  | { status: 'idle' }
  | {
      status: 'running';
      runId: string;
      expanded: number;
      generated: number;
      elapsedMs: number;
    }
  | {
      status: 'completed';
      algorithmId: string;
      solutionMoves?: string;
      resultStatus: string;
      elapsedMs: number;
    }
  | { status: 'cancelled'; message: string }
  | { status: 'failed'; message: string };

export type BenchState =
  | { status: 'idle' }
  | { status: 'running' }
  | {
      status: 'completed';
      runId: string;
      resultStatus: string;
      elapsedMs: number;
      expanded: number;
      generated: number;
    }
  | { status: 'cancelled'; message: string }
  | { status: 'failed'; message: string };

export type RunToken = {
  runId: string;
  authoredRevision: number;
};
