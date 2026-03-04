import {
  ALGORITHM_IDS,
  HEURISTIC_IDS,
  MAX_HEURISTIC_WEIGHT,
  MIN_HEURISTIC_WEIGHT,
} from '@corgiban/solver';
import { z } from 'zod';

import { PROTOCOL_VERSION } from './protocol';

const protocolVersionSchema = z.literal(PROTOCOL_VERSION);

const runIdSchema = z.string().min(1);

const algorithmIdSchema = z.enum(ALGORITHM_IDS);

const heuristicIdSchema = z.enum(HEURISTIC_IDS);

const solverOptionsSchema = z
  .object({
    timeBudgetMs: z.number().positive().optional(),
    nodeBudget: z.number().positive().optional(),
    heuristicId: heuristicIdSchema.optional(),
    heuristicWeight: z.number().min(MIN_HEURISTIC_WEIGHT).max(MAX_HEURISTIC_WEIGHT).optional(),
    enableSpectatorStream: z.boolean().optional(),
  })
  .strict();

const levelRuntimeSchema = z
  .object({
    levelId: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    staticGrid: z.instanceof(Uint8Array),
    initialPlayerIndex: z.number().int(),
    initialBoxes: z.instanceof(Uint32Array),
  })
  .strict()
  .superRefine((value, context) => {
    const cellCount = value.width * value.height;
    if (!Number.isSafeInteger(cellCount) || cellCount <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['width'],
        message: 'width and height must produce a safe positive cell count.',
      });
      return;
    }

    if (value.staticGrid.length !== cellCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['staticGrid'],
        message: `staticGrid length must equal width * height (${cellCount}).`,
      });
    }

    if (value.initialPlayerIndex < 0 || value.initialPlayerIndex >= cellCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['initialPlayerIndex'],
        message: `initialPlayerIndex must be within [0, ${cellCount - 1}].`,
      });
    }

    const seenBoxes = new Set<number>();
    for (let index = 0; index < value.initialBoxes.length; index += 1) {
      const boxIndex = value.initialBoxes[index];
      if (boxIndex < 0 || boxIndex >= cellCount) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['initialBoxes', index],
          message: `initial box index must be within [0, ${cellCount - 1}].`,
        });
      }
      if (seenBoxes.has(boxIndex)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['initialBoxes', index],
          message: 'initialBoxes must not contain duplicates.',
        });
      }
      seenBoxes.add(boxIndex);
    }
  });

const solveStartSchema = z
  .object({
    type: z.literal('SOLVE_START'),
    runId: runIdSchema,
    protocolVersion: protocolVersionSchema,
    levelRuntime: levelRuntimeSchema,
    algorithmId: algorithmIdSchema,
    options: solverOptionsSchema.optional(),
  })
  .strict();

const solveProgressSchema = z
  .object({
    type: z.literal('SOLVE_PROGRESS'),
    runId: runIdSchema,
    protocolVersion: protocolVersionSchema,
    expanded: z.number().int().nonnegative(),
    generated: z.number().int().nonnegative(),
    depth: z.number().int().nonnegative(),
    frontier: z.number().int().nonnegative(),
    elapsedMs: z.number().nonnegative(),
    bestHeuristic: z.number().optional(),
    bestPathSoFar: z.string().optional(),
  })
  .strict();

const solverMetricsSchema = z
  .object({
    elapsedMs: z.number().nonnegative(),
    expanded: z.number().int().nonnegative(),
    generated: z.number().int().nonnegative(),
    maxDepth: z.number().int().nonnegative(),
    maxFrontier: z.number().int().nonnegative(),
    pushCount: z.number().int().nonnegative(),
    moveCount: z.number().int().nonnegative(),
  })
  .strict();

const solveResultBaseSchema = z
  .object({
    type: z.literal('SOLVE_RESULT'),
    runId: runIdSchema,
    protocolVersion: protocolVersionSchema,
    metrics: solverMetricsSchema,
  })
  .strict();

const solveResultNonErrorSchema = solveResultBaseSchema
  .extend({
    status: z.enum(['solved', 'unsolved', 'timeout', 'cancelled']),
    solutionMoves: z.string().optional(),
  })
  .strict();

const solveResultErrorSchema = solveResultBaseSchema
  .extend({
    status: z.literal('error'),
    errorMessage: z.string(),
    errorDetails: z.string().optional(),
  })
  .strict();

const solveResultSchema = z.union([solveResultNonErrorSchema, solveResultErrorSchema]);

const solveErrorSchema = z
  .object({
    type: z.literal('SOLVE_ERROR'),
    runId: runIdSchema,
    protocolVersion: protocolVersionSchema,
    message: z.string(),
    details: z.string().optional(),
  })
  .strict();

export const pingSchema = z
  .object({
    type: z.literal('PING'),
    protocolVersion: protocolVersionSchema,
  })
  .strict();

export const pongSchema = z
  .object({
    type: z.literal('PONG'),
    protocolVersion: protocolVersionSchema,
  })
  .strict();

export const workerInboundSchema = z.union([solveStartSchema, pingSchema]);

export const workerOutboundSchema = z.union([
  solveProgressSchema,
  solveResultSchema,
  solveErrorSchema,
  pongSchema,
]);

export function parseWorkerInboundMessage(payload: unknown) {
  return workerInboundSchema.safeParse(payload);
}

export function parseWorkerOutboundMessage(payload: unknown) {
  return workerOutboundSchema.safeParse(payload);
}

export const solverSchemas = {
  solveStartSchema,
  solveProgressSchema,
  solveResultSchema,
  solveErrorSchema,
  pingSchema,
  pongSchema,
};
