import type { ZodError } from 'zod';

import { PROTOCOL_VERSION } from './protocol';
import type { SolveProgressMessage, WorkerInboundMessage, WorkerOutboundMessage } from './protocol';
import { parseWorkerInboundMessage, parseWorkerOutboundMessage } from './schema';

type ValidationDirection = 'inbound' | 'outbound';

export type OutboundValidationMode = 'strict' | 'light-progress';

export type ValidateOutboundMessageOptions = {
  mode?: OutboundValidationMode;
};

export type ProtocolValidationIssue = {
  path: string;
  message: string;
};

export class ProtocolValidationError extends Error {
  readonly direction: ValidationDirection;
  readonly issues: ProtocolValidationIssue[];
  readonly payload: unknown;

  constructor(direction: ValidationDirection, issues: ProtocolValidationIssue[], payload: unknown) {
    const issueText = issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
    super(`Invalid ${direction} protocol message. ${issueText}`);
    this.direction = direction;
    this.issues = issues;
    this.payload = payload;
    this.name = 'ProtocolValidationError';
  }
}

export type ProtocolValidationResult<T> =
  | {
      ok: true;
      message: T;
    }
  | {
      ok: false;
      error: ProtocolValidationError;
    };

function buildIssues(error: ZodError): ProtocolValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length === 0 ? '<root>' : issue.path.join('.'),
    message: issue.message,
  }));
}

function buildValidationError(
  direction: ValidationDirection,
  payload: unknown,
  error: ZodError,
): ProtocolValidationError {
  return new ProtocolValidationError(direction, buildIssues(error), payload);
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && isNonNegativeNumber(value);
}

function isSolveProgressLightMessage(payload: unknown): payload is SolveProgressMessage {
  if (!isObjectLike(payload)) {
    return false;
  }

  if (payload.type !== 'SOLVE_PROGRESS') {
    return false;
  }

  if (payload.protocolVersion !== PROTOCOL_VERSION) {
    return false;
  }

  if (typeof payload.runId !== 'string' || payload.runId.length === 0) {
    return false;
  }

  if (!isNonNegativeInteger(payload.expanded)) {
    return false;
  }
  if (!isNonNegativeInteger(payload.generated)) {
    return false;
  }
  if (!isNonNegativeInteger(payload.depth)) {
    return false;
  }
  if (!isNonNegativeInteger(payload.frontier)) {
    return false;
  }
  if (!isNonNegativeNumber(payload.elapsedMs)) {
    return false;
  }
  if (payload.bestHeuristic !== undefined && typeof payload.bestHeuristic !== 'number') {
    return false;
  }
  if (payload.bestPathSoFar !== undefined && typeof payload.bestPathSoFar !== 'string') {
    return false;
  }

  return true;
}

export function validateInboundMessage(
  payload: unknown,
): ProtocolValidationResult<WorkerInboundMessage> {
  const parsed = parseWorkerInboundMessage(payload);
  if (parsed.success) {
    return { ok: true, message: parsed.data };
  }

  return {
    ok: false,
    error: buildValidationError('inbound', payload, parsed.error),
  };
}

export function validateOutboundMessage(
  payload: unknown,
  options?: ValidateOutboundMessageOptions,
): ProtocolValidationResult<WorkerOutboundMessage> {
  if (options?.mode === 'light-progress' && isSolveProgressLightMessage(payload)) {
    return {
      ok: true,
      message: payload,
    };
  }

  const parsed = parseWorkerOutboundMessage(payload);
  if (parsed.success) {
    return { ok: true, message: parsed.data };
  }

  return {
    ok: false,
    error: buildValidationError('outbound', payload, parsed.error),
  };
}

export function assertInboundMessage(payload: unknown): WorkerInboundMessage {
  const result = validateInboundMessage(payload);
  if (!result.ok) {
    throw result.error;
  }
  return result.message;
}

export function assertOutboundMessage(payload: unknown): WorkerOutboundMessage {
  const result = validateOutboundMessage(payload);
  if (!result.ok) {
    throw result.error;
  }
  return result.message;
}
