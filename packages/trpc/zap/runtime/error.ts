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

/** Map an AppError code to the wire status (mirrors the tRPC code→status map). */
export function statusForCode(code: string): number {
  return genericErrorCodeToTrpcErrorCodeMap[code]?.status ?? 400;
}

/**
 * Build a typed handler error. Throw this (or a raw AppError) from a ZAP
 * handler; the dispatcher serialises it into a ZapReply with the right status
 * and the AppError JSON, exactly as tRPC's errorFormatter did.
 */
export function methodError(
  code: AppErrorCode | string,
  message?: string,
): AppError {
  return new AppError(code, message ? { message } : undefined);
}

/** Status + AppError-JSON for any thrown value, for ZapReply encoding. */
export function toWireError(err: unknown): { status: number; errorJson: string } {
  const appError = AppError.parseError(err);
  return {
    status: appError.statusCode ?? statusForCode(appError.code),
    errorJson: AppError.toJSONString(appError),
  };
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
