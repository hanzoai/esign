// esign ZAP RPC — browser client.
//
// Opens a single ZAP-over-WebSocket connection (lazily, shared) and exposes a
// typed `call(route, input)` that ships a ZapRequest and resolves the decoded
// result — or throws the reconstructed AppError. This is the transport the
// migrated React hooks (../react) sit on. Wire is binary ZAP; payloads are
// SuperJSON strings (the same transformer tRPC used), with any file read into
// bytes first (../runtime/file).
import type { Conn } from '@zap-proto/web';
import { type Connection, connect } from '@zap-proto/web/client';
import SuperJSON from 'superjson';

import { getBaseUrl } from '@hanzo/esign-lib/universal/get-base-url';

import { ZapReply, newZapRequest } from '../gen/transport_zap';
import { fromWireError } from '../runtime/error';
import { pack } from '../runtime/file';
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

let currentTeam: number | null = null;

/**
 * Scope every subsequent call to a team, until it changes.
 *
 * tRPC sent the team on each HTTP request as `x-team-id`. ZAP shares one socket
 * per tab, and a browser cannot set headers on a WebSocket handshake, so the
 * team rides the per-call envelope instead. The app declares it once where it
 * knows the team (the team provider); handlers still verify membership, so this
 * selects a scope rather than granting one.
 *
 * A no-op off the browser. The team provider renders during SSR too, where one
 * process serves every tenant at once — a module-level team there would be one
 * request's scope visible to another. There is no browser to hold a socket off
 * the page, so there is nothing to scope either.
 */
export function setZapTeam(teamId: number | null): void {
  if (typeof window === 'undefined') return;

  currentTeam = teamId;
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

  const teamId = opts.teamId ?? currentTeam;

  const payload = newZapRequest({
    method: route,
    payload: input === undefined ? '' : SuperJSON.stringify(await pack(input)),
    teamId: teamId === null || teamId === undefined ? '' : String(teamId),
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
