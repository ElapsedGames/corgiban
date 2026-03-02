import {
  ALGORITHM_IDS,
  HEURISTIC_IDS,
  MAX_HEURISTIC_WEIGHT,
  MIN_HEURISTIC_WEIGHT,
} from '@corgiban/solver';
import { z } from 'zod';

const protocolVersionSchema = z.literal(1);

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
  .strict();

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

const solveCancelSchema = z
  .object({
    type: z.literal('SOLVE_CANCEL'),
    runId: runIdSchema,
    protocolVersion: protocolVersionSchema,
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

const solveResultSchema = z
  .object({
    type: z.literal('SOLVE_RESULT'),
    runId: runIdSchema,
    protocolVersion: protocolVersionSchema,
    status: z.enum(['solved', 'unsolved', 'timeout', 'cancelled', 'error']),
    solutionMoves: z.string().optional(),
    metrics: solverMetricsSchema,
  })
  .strict();

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

export const workerInboundSchema = z.union([solveStartSchema, solveCancelSchema, pingSchema]);

export const workerOutboundSchema = z.union([
  solveProgressSchema,
  solveResultSchema,
  solveErrorSchema,
  pongSchema,
]);

export const solverSchemas = {
  solveStartSchema,
  solveCancelSchema,
  solveProgressSchema,
  solveResultSchema,
  solveErrorSchema,
  pingSchema,
  pongSchema,
};
