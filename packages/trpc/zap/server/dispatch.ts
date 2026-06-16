// esign ZAP RPC — the server-side dispatcher.
//
// One CallHandler routes every esign procedure. It decodes the ZapRequest
// envelope, looks up the handler registered for the route ("<router>.<proc>"),
// runs it with the per-connection ZapContext (applying any per-call teamId
// override carried on the envelope, the ZAP analogue of tRPC's x-team-id
// header), and encodes the result — or the mapped AppError — into a ZapReply.
//
// Payloads ride as SuperJSON strings, the exact transformer tRPC used, so the
// typed-object semantics every callsite depends on survive the transport swap.
// The wire itself is binary ZAP (ZapRequest/ZapReply structs over WS frames),
// not JSON-RPC.
import type { CallHandler } from '@zap-proto/web';
import type { Call, Response } from '@zap-proto/zap';
import { Status } from '@zap-proto/zap';
import SuperJSON from 'superjson';

import { ZapReply, ZapRequest, newZapReply } from '../gen/transport_zap';
import { toWireError } from '../runtime/error';
import type { ZapContext } from './context';

/** A typed procedure handler: (ctx, input) → output. */
export type ZapHandler = (ctx: ZapContext, input: unknown) => Promise<unknown> | unknown;

/** route ("<router>.<procedure>") → handler. */
export type ZapRouteMap = Record<string, ZapHandler>;

const encoder = (value: unknown): string => (value === undefined ? '' : SuperJSON.stringify(value));
const decoder = (s: string): unknown => (s === '' ? undefined : SuperJSON.parse(s));

/**
 * Build the rootCap CallHandler over a route map. Unknown / unported routes
 * resolve to a NOT_FOUND "not-yet-migrated" ZapReply so the build stays green
 * while routers are ported incrementally.
 */
export function makeDispatcher(routes: ZapRouteMap) {
  return (ctx: ZapContext): CallHandler => {
    return async (call: Call): Promise<Response> => {
      let req: ZapRequest;
      try {
        req = ZapRequest.wrap(call.payload);
      } catch {
        return reply(call.promiseID, {
          ok: false,
          status: Status.BadRequest,
          result: '',
          errorJson: JSON.stringify({
            code: 'INVALID_BODY',
            message: 'malformed ZAP request envelope',
          }),
        });
      }

      const route = req.method;
      const handler = routes[route];
      if (!handler) {
        return reply(call.promiseID, {
          ok: false,
          status: Status.NotFound,
          result: '',
          errorJson: JSON.stringify({
            code: 'NOT_FOUND',
            message: `not-yet-migrated: ${route}`,
          }),
        });
      }

      // Per-call teamId override (ZAP analogue of the x-team-id header).
      const perCallTeamId = req.teamId ? Number(req.teamId) : NaN;
      const ctxForCall: ZapContext =
        Number.isFinite(perCallTeamId) && perCallTeamId > 0
          ? { ...ctx, teamId: perCallTeamId }
          : ctx;

      try {
        const input = decoder(req.payload);
        const output = await handler(ctxForCall, input);
        return reply(call.promiseID, {
          ok: true,
          status: Status.OK,
          result: encoder(output),
          errorJson: '',
        });
      } catch (err) {
        const { status, errorJson } = toWireError(err);
        return reply(call.promiseID, { ok: false, status, result: '', errorJson });
      }
    };
  };
}

interface ReplyFields {
  ok: boolean;
  status: number;
  result: string;
  errorJson: string;
}

function reply(promiseID: number, fields: ReplyFields): Response {
  const body = newZapReply(fields);
  return { status: fields.status, promiseID, body };
}

/** Decode a ZapReply body on the client side. */
export function readReply(body: Uint8Array): ReplyFields {
  const r = ZapReply.wrap(body);
  return { ok: r.ok, status: r.status, result: r.result, errorJson: r.errorJson };
}

export const zapCodec = { encode: encoder, decode: decoder };
