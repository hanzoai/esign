// esign ZAP RPC — the MintCap auth boundary.
//
// This is the single replacement for tRPC's `authenticatedMiddleware`. It runs
// ONCE at the WebSocket upgrade (before the socket opens) and turns the bearer
// (API token) or the session cookie into a `ZapContext`. Returning `null`
// rejects the upgrade with HTTP 401 — no socket is ever opened for an
// unauthenticated request, the ZAP analogue of throwing UNAUTHORIZED.
//
// Auth semantics are byte-identical to the tRPC middleware:
//   - "Authorization: [Bearer] <token>"  → getApiTokenByToken, auth:'api'
//   - else session cookie                 → getOptionalSession,  auth:'session'
// The same getApiTokenByToken + session validation functions are reused, so
// there is no second auth code path.
import type { MintCap } from '@zap-proto/web/server';
import type { IncomingMessage } from 'node:http';

import { getOptionalSession } from '@hanzo/esign-auth/server/lib/utils/get-session';
import { getApiTokenByToken } from '@hanzo/esign-lib/server-only/public-api/get-api-token-by-token';
import { extractRequestMetadata } from '@hanzo/esign-lib/universal/extract-request-metadata';
import { alphaid } from '@hanzo/esign-lib/universal/id';
import { logger } from '@hanzo/esign-lib/utils/logger';

import type { ZapContext } from './context';

/** Build a Fetch Request mirroring the Node upgrade request (headers/cookies). */
function toFetchRequest(req: IncomingMessage): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `http://${host}`);
  return new Request(url.toString(), { method: 'GET', headers });
}

/** Parse a "[Bearer] <token>" Authorization header value. */
function parseBearer(value: string | undefined): string | null {
  if (!value) return null;
  const [token] = value.split('Bearer ').filter((s) => s.length > 0);
  return token ?? null;
}

/** The request source, mirroring tRPC's `requestSource`. */
export type MintSource = 'app' | 'apiV1' | 'apiV2';

/**
 * bearer/session → ZapContext, or null (401). The WS upgrade reaches this
 * through makeMintCap; the v2 REST face calls it per request.
 */
export async function mint(source: MintSource, fetchReq: Request): Promise<ZapContext | null> {
  const requestMetadata = extractRequestMetadata(fetchReq);
  const baseLogger = logger.child({
    ipAddress: requestMetadata.ipAddress,
    userAgent: requestMetadata.userAgent,
    requestId: alphaid(),
  });

  const token = parseBearer(fetchReq.headers.get('authorization') ?? undefined);

  // API-token auth.
  if (token) {
    const apiToken = await getApiTokenByToken({ token }).catch(() => null);
    if (!apiToken) return null;
    return {
      user: apiToken.user,
      session: null,
      teamId: apiToken.teamId ?? -1,
      logger: baseLogger,
      metadata: {
        requestMetadata,
        source,
        auth: 'api',
        auditUser: apiToken.team
          ? { id: null, email: null, name: apiToken.team.name }
          : {
              id: apiToken.user.id,
              email: apiToken.user.email,
              name: apiToken.user.name,
            },
      },
    };
  }

  // Session-cookie auth.
  const { session, user } = await getOptionalSession(fetchReq).catch(() => ({
    session: null,
    user: null,
  }));
  if (!session || !user) return null;

  const teamIdHeader = fetchReq.headers.get('x-team-id');
  const parsedTeamId = teamIdHeader ? Number(teamIdHeader) : NaN;

  return {
    user,
    session,
    teamId: Number.isFinite(parsedTeamId) && parsedTeamId > 0 ? parsedTeamId : -1,
    logger: baseLogger,
    metadata: {
      requestMetadata,
      source,
      auth: 'session',
      auditUser: { id: user.id, name: user.name, email: user.email },
    },
  };
}

/** The WS upgrade's MintCap: the same mint, over a Node upgrade request. */
export function makeMintCap(source: MintSource = 'app'): MintCap<ZapContext> {
  return async (req: IncomingMessage) => await mint(source, toFetchRequest(req));
}
