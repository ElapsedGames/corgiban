import type { ZodError } from 'zod';

import type { WorkerInboundMessage, WorkerOutboundMessage } from './protocol';
import { parseWorkerInboundMessage, parseWorkerOutboundMessage } from './schema';

type ValidationDirection = 'inbound' | 'outbound';

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
): ProtocolValidationResult<WorkerOutboundMessage> {
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
