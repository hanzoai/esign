// esign ZAP RPC — error mapping.
//
// tRPC mapped AppError → TRPCError with an HTTP status; the ZAP layer maps
// AppError → ZapReply{ Ok:false, Status, ErrorJson }. The errorCode semantics
// are preserved verbatim via AppError.toJSON / AppError.parseFromJSON, so a
// client can reconstruct the exact AppError it would have received over tRPC.
//
// `methodError(code, message?)` is the ZAP analogue of `throw new AppError(...)`
// inside a handler — it produces a typed error that the dispatcher serialises
// into a ZapReply. This is the replacement the migration brief calls for
// ("AppError → methodError(...)").
import { Status } from '@zap-proto/zap';

import {
  AppError,
  AppErrorCode,
  genericErrorCodeToTrpcErrorCodeMap,
} from '@hanzo/esign-lib/errors/app-error';

const APP_ERROR_CODES = new Set<string>(Object.values(AppErrorCode));

/**
 * Map an error code to the wire status (mirrors the tRPC code→status map).
 *
 * A value thrown from deeper down carries its own `code` — Prisma's `P2025`, a
 * Node errno — and AppError.parseError adopts it as-is. Those are ours to
 * answer for, so they get 500, the way tRPC answered any error it did not
 * raise itself. Only a code we actually define falls back to 400.
 */
export function statusForCode(code: string): number {
  return (
    genericErrorCodeToTrpcErrorCodeMap[code]?.status ?? (APP_ERROR_CODES.has(code) ? 400 : 500)
  );
}

/**
 * Build a typed handler error. Throw this (or a raw AppError) from a ZAP
 * handler; the dispatcher serialises it into a ZapReply with the right status
 * and the AppError JSON, exactly as tRPC's errorFormatter did.
 */
export function methodError(code: AppErrorCode | string, message?: string): AppError {
  return new AppError(code, message ? { message } : undefined);
}

/** Status + AppError-JSON for any thrown value, for ZapReply encoding. */
export function toWireError(err: unknown): { status: number; errorJson: string } {
  // A handler validates its own input, so a schema rejection surfaces here as a
  // raw ZodError. tRPC answered those 400 BAD_REQUEST because the caller sent
  // the wrong thing; without this they would read as an unknown 500.
  const appError = isZodError(err)
    ? new AppError(AppErrorCode.INVALID_BODY, { message: zodMessage(err) })
    : AppError.parseError(err);

  return {
    status: appError.statusCode ?? statusForCode(appError.code),
    errorJson: AppError.toJSONString(appError),
  };
}

interface ZodIssue {
  path: (string | number)[];
  message: string;
}

/** ZodError by shape, so this does not depend on which copy of zod threw. */
function isZodError(err: unknown): err is { name: string; issues: ZodIssue[] } {
  return (
    err instanceof Error &&
    err.name === 'ZodError' &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}

/** "payload.title: Required, files: Expected array" — the failing fields. */
function zodMessage(err: { issues: ZodIssue[] }): string {
  return err.issues
    .map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ` : '') + issue.message)
    .join(', ');
}

/** Reconstruct the AppError a client received in a failed ZapReply. */
export function fromWireError(status: number, errorJson: string): AppError {
  // AppError.parseFromJSON expects the parsed object, not the JSON string.
  let parsed: AppError | null = null;
  if (errorJson) {
    try {
      parsed = AppError.parseFromJSON(JSON.parse(errorJson) as unknown);
    } catch {
      parsed = null;
    }
  }
  if (parsed) return parsed;
  return new AppError(AppErrorCode.UNKNOWN_ERROR, {
    message: `ZAP RPC failed with status ${status}`,
    statusCode: status,
  });
}

export { Status };
