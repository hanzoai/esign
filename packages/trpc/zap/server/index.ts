// esign ZAP RPC — server entry.
//
// `serveZap(httpServer)` attaches the ZAP-over-WebSocket RPC endpoint to the
// Remix Node http.Server (one line, one port — same server that serves the
// app). This is the replacement for mounting the tRPC HTTP handler. Auth runs
// at the WS upgrade via the esign MintCap; every decoded call is routed by the
// dispatcher over the registered route map.

import type { Server as HttpServer } from 'node:http';

import { serve, type ServeHandle } from '@zap-proto/web/server';

import { ZAP_PATH } from '../runtime/path';
import { makeDispatcher } from './dispatch';
import { makeMintCap } from './mint';
import { zapRoutes } from './routes';

export { ZAP_PATH };

/** Attach the esign ZAP RPC endpoint to an existing Node http.Server. */
export function serveZap(
  httpServer: HttpServer,
  opts: { path?: string; onError?: (err: unknown) => void } = {},
): ServeHandle {
  return serve(httpServer, {
    path: opts.path ?? ZAP_PATH,
    mintCap: makeMintCap('app'),
    rootCap: makeDispatcher(zapRoutes),
    onError: opts.onError,
  });
}

export { zapRoutes, migratedRoutes } from './routes';
export type { ZapContext } from './context';
export type { ZapHandler, ZapRouteMap } from './dispatch';
