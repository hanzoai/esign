/**
 * This is the main entry point for the server which will launch the RR7 application
 * and spin up auth, api, etc.
 *
 * Note:
 *  This file will be copied to the build folder during build time.
 *  Running this file will not work without a build.
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import handle from 'hono-react-router-adapter/node';

import server from './hono/server/router.js';
// serveZap (WebSocket) comes from the rollup-bundled zap/server module — the
// first-party esign ZAP server layer is bundled there (it's .ts workspace source
// that can't resolve at runtime as a package subpath). See rollup.config.mjs
// (server/zap/server.ts is a build input).
import { serveZap } from './hono/server/zap/server.js';
import * as build from './index.js';

server.use(
  serveStatic({
    root: 'build/client',
    onFound: (path, c) => {
      if (path.startsWith('build/client/assets')) {
        // Hard cache assets with hashed file names.
        c.header('Cache-Control', 'public, immutable, max-age=31536000');
      } else {
        // Cache with revalidation for rest of static files.
        c.header('Cache-Control', 'public, max-age=0, stale-while-revalidate=86400');
      }
    },
  }),
);

const handler = handle(build, server);

const port = parseInt(process.env.PORT || '3000', 10);

// @hono/node-server's serve() returns the underlying Node http.Server; attach
// the ZAP-over-WebSocket RPC endpoint to it so it shares the app's port. This
// is the @zap-proto/web replacement for mounting the tRPC HTTP handler — all
// 14 routers are served over ZAP (see @hanzo/esign-trpc/zap/server/routes).
const httpServer = serve({ fetch: handler.fetch, port });

serveZap(httpServer, {
  onError: (err) => console.error('[zap-rpc]', err),
});
