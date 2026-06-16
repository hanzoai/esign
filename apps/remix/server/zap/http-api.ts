// esign ZAP RPC — JSON-over-HTTP face for the /api/v2 REST surface.
//
// The legacy `/api/v2/*` REST surface (external integrators) was backed by
// trpc-to-openapi routing HTTP -> the tRPC appRouter. This re-backs it with
// `httpServe` from @zap-proto/web/server, dispatching every request through the
// SAME zapRoutes map + makeDispatcher the WebSocket server uses — one service
// implementation, reached two ways (WS and HTTP). NO tRPC.
//
// Each OpenAPI operation becomes one POST HttpRoute whose codec mirrors the
// browser ZAP client (zap/client): the JSON body is wrapped into a ZapRequest
// envelope carrying the route string (the operationId) as `method`, the payload
// as a SuperJSON string, under the single METHOD_RPC ordinal; the ZapReply is
// unwrapped back to JSON (or the reconstructed AppError is thrown).
//
// Auth is per-request via makeMintCap('apiV2'), which reads
// "Authorization: Bearer <token>" off the IncomingMessage and resolves it via
// getApiTokenByToken — identical to the tRPC apiV2 context. httpServe hands the
// mint the raw upgrade/request auth boundary, so no second auth path exists.
import type { Server as HttpServer } from 'node:http';

import { type HttpRoute, type HttpServeHandle, httpServe } from '@zap-proto/web/server';
import SuperJSON from 'superjson';

import { makeDispatcher } from '@hanzo/sign-trpc/zap/server/dispatch';
import { fromWireError } from '@hanzo/sign-trpc/zap/runtime/error';
import { METHOD_RPC } from '@hanzo/sign-trpc/zap/runtime/method';
import { makeMintCap } from '@hanzo/sign-trpc/zap/server/mint';
import { zapRoutes } from '@hanzo/sign-trpc/zap/server/routes';
import { ZapReply, newZapRequest } from '@hanzo/sign-trpc/zap/gen/transport_zap';

import openapi from '@hanzo/sign-trpc/zap/gen/openapi.json';

interface OpenApiPaths {
  paths: Record<string, { post?: { operationId?: string } }>;
}

/**
 * Build one HttpRoute per `(path, post.operationId)` in the composite OpenAPI
 * doc. The route string carried on the envelope is the operationId
 * ("<router>.<procedure>"), which is exactly the key zapRoutes is registered
 * under — so the HTTP face and the WS face resolve to the identical handler.
 */
function buildRoutes(): HttpRoute[] {
  const { paths } = openapi as OpenApiPaths;
  const routes: HttpRoute[] = [];

  for (const [path, item] of Object.entries(paths)) {
    const operationId = item.post?.operationId;
    if (!operationId) continue;

    routes.push({
      path,
      method: METHOD_RPC,
      decode: (json: unknown): Uint8Array =>
        newZapRequest({
          method: operationId,
          payload: json === undefined || json === null ? '' : SuperJSON.stringify(json),
          teamId: '',
        }),
      encode: (body: Uint8Array): unknown => {
        const reply = ZapReply.wrap(body);
        if (!reply.ok) {
          throw fromWireError(reply.status, reply.errorJson);
        }
        return reply.result === '' ? undefined : SuperJSON.parse(reply.result);
      },
    });
  }

  return routes;
}

/**
 * Mount the JSON-over-HTTP ZAP face on `httpServer` at both `/api/v2` and
 * `/api/v2-beta`, sharing the WS server's port. httpServe only terminates its
 * declared POST routes and passes every other request through, so the Hono
 * GET `/api/v2/openapi.json` and the GET download routes still reach Hono.
 */
export function serveZapHttpApi(
  httpServer: HttpServer,
  opts: { onError?: (err: unknown) => void } = {},
): HttpServeHandle[] {
  const routes = buildRoutes();
  const rootCap = makeDispatcher(zapRoutes);
  const mintCap = makeMintCap('apiV2');

  return ['/api/v2', '/api/v2-beta'].map((prefix) =>
    httpServe(httpServer, {
      prefix,
      routes,
      mintCap,
      rootCap,
      onError: opts.onError,
    }),
  );
}
