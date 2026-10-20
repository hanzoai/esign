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
//   - else session cookie                 → getOptionalSession,  auth:'session',
//     only when Origin is the app's own
// The same getApiTokenByToken + session validation functions are reused, so
// there is no second auth code path.
import type { MintCap } from '@zap-proto/web/server';
import type { IncomingMessage } from 'node:http';

import { getOptionalSession } from '@hanzo/esign-auth/server/lib/utils/get-session';
import { NEXT_PUBLIC_WEBAPP_URL } from '@hanzo/esign-lib/constants/app';
import { getApiTokenByToken } from '@hanzo/esign-lib/server-only/public-api/get-api-token-by-token';
import { extractRequestMetadata } from '@hanzo/esign-lib/universal/extract-request-metadata';
import { alphaid } from '@hanzo/esign-lib/universal/id';
import { logger } from '@hanzo/esign-lib/utils/logger';

import type { ZapConnectionContext } from './context';

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

/**
 * The esign MintCap: bearer/session → ZapContext; no session on the app's own
 * pages → an anonymous context (public routes only); otherwise null (401).
 * `source` mirrors the tRPC `requestSource` ('app' | 'apiV1' | 'apiV2').
 */
export function makeMintCap(
  source: 'app' | 'apiV1' | 'apiV2' = 'app',
): MintCap<ZapConnectionContext> {
  return async (req: IncomingMessage): Promise<ZapConnectionContext | null> => {
    const fetchReq = toFetchRequest(req);
    const requestMetadata = extractRequestMetadata(fetchReq);
    const baseLogger = logger.child({
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      requestId: alphaid(),
    });

    const token = parseBearer(req.headers.authorization);

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

    // Session-cookie auth, for the app's own pages only. The browser attaches
    // the cookie to every request to this host, whichever site started it;
    // Origin names that site, and a session acts only for this one.
    if (req.headers.origin !== new URL(NEXT_PUBLIC_WEBAPP_URL()).origin) return null;

    const { session, user } = await getOptionalSession(fetchReq).catch(() => ({
      session: null,
      user: null,
    }));

    // No session: the app's pages still serve people without an account — a
    // recipient signing by their link, a visitor on a direct template link. The
    // socket opens for them as anonymous, and the dispatcher lets an anonymous
    // connection reach only the public routes. The operation API has no such
    // caller: there a request without a token is refused.
    if (!session || !user) {
      if (source !== 'app') return null;

      return {
        user: null,
        session: null,
        teamId: -1,
        logger: baseLogger,
        metadata: {
          requestMetadata,
          source,
          auth: null,
        },
      };
    }

    const rawTeamId = req.headers['x-team-id'];
    const teamIdHeader = Array.isArray(rawTeamId) ? rawTeamId[0] : rawTeamId;
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
  };
}
