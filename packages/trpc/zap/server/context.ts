// esign ZAP RPC — per-connection context.
//
// The minted context the ZAP server threads into every handler. It is the
// subset of the tRPC `TrpcContext` the migrated handlers actually consume:
// the authenticated user, the (optional) session, the resolved teamId, the
// request metadata, and a logger. Auth is established ONCE at the WebSocket
// upgrade (see mint.ts), exactly like tRPC's authenticatedMiddleware ran per
// request — the difference is the ZAP context is per-connection, set when the
// socket opens.

import type { Session } from '@prisma/client';
import type { Logger } from 'pino';

import type { ApiRequestMetadata } from '@hanzo/esign-lib/universal/extract-request-metadata';

/**
 * The authenticated principal common to both auth paths. Session auth yields a
 * full SessionUser and API-token auth yields the narrower apiToken.user select;
 * the migrated handlers only read id/name/email, the intersection of the two,
 * mirroring what tRPC's `ctx.user` exposed across its session/api branches.
 */
export interface ZapUser {
  id: number;
  name: string | null;
  email: string;
}

/** Authenticated per-connection context for ZAP handlers. */
export interface ZapContext {
  user: ZapUser;
  /** Present for session auth, null for API-token auth (mirrors tRPC). */
  session: Session | null;
  /** Resolved team id; -1 when a session has no team (tRPC convention). */
  teamId: number;
  metadata: ApiRequestMetadata;
  logger: Logger;
}
