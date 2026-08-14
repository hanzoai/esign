// esign ZAP RPC — browser client.
//
// Opens a single ZAP-over-WebSocket connection (lazily, shared) and exposes a
// typed `call(route, input)` that ships a ZapRequest and resolves the decoded
// result — or throws the reconstructed AppError. This is the transport the
// migrated React hooks (../react) sit on. Wire is binary ZAP; payloads are
// SuperJSON strings (the same transformer tRPC used).
import type { Conn } from '@zap-proto/web';
import { type Connection, connect } from '@zap-proto/web/client';
import SuperJSON from 'superjson';

import { getBaseUrl } from '@hanzo/esign-lib/universal/get-base-url';

import { ZapReply, newZapRequest } from '../gen/transport_zap';
import { fromWireError } from '../runtime/error';
import { METHOD_RPC } from '../runtime/method';
import { ZAP_PATH } from '../runtime/path';

/** Build the wss:// URL for the ZAP endpoint from the app base URL. */
export function zapUrl(): string {
  // A WebSocket is dialled by absolute origin — it has no relative form. In the
  // browser `getBaseUrl()` is `''` (the relative-fetch convention the HTTP
  // transport wants), and `new URL('')` throws, so read the origin off the page
  // that is making the call. Off the page, fall back to the configured URL.
  const base = typeof window !== 'undefined' ? window.location.origin : getBaseUrl();
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = ZAP_PATH;
  return url.toString();
}

let shared: Promise<Connection<Conn>> | null = null;

/** Open (or reuse) the shared ZAP connection. */
async function getConnection(): Promise<Connection<Conn>> {
  if (!shared) {
    shared = connect<Conn>(zapUrl()).catch((err) => {
      shared = null;
      throw err;
    });
  }
  return shared;
}

export interface ZapCallOptions {
  /** Per-call team id override (ZAP analogue of the x-team-id header). */
  teamId?: number | string;
}

/**
 * Call a migrated ZAP route. Resolves the decoded output; throws the
 * reconstructed AppError on a non-OK reply. `<T>` is the procedure output type.
 */
export async function zapCall<T = unknown>(
  route: string,
  input?: unknown,
  opts: ZapCallOptions = {},
): Promise<T> {
  const conn = await getConnection();

  const payload = newZapRequest({
    method: route,
    payload: input === undefined ? '' : SuperJSON.stringify(input),
    teamId: opts.teamId === undefined ? '' : String(opts.teamId),
  });

  const resp = await conn.bootstrap.call(METHOD_RPC, { payload });
  const reply = ZapReply.wrap(resp.body);

  if (!reply.ok) {
    throw fromWireError(reply.status, reply.errorJson);
  }
  return (reply.result === '' ? undefined : SuperJSON.parse(reply.result)) as T;
}

/** Close the shared connection (e.g. on logout). */
export async function closeZap(): Promise<void> {
  // Claim the slot before awaiting: a caller that dials in the meantime gets a
  // fresh connection, and this call closes the one it actually took.
  const pending = shared;

  if (!pending) return;

  shared = null;

  const conn = await pending.catch(() => null);

  conn?.close();
}
