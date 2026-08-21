// Re-export the WebSocket ZAP server so the raw-copied server/main.js can import
// it from a single rollup-bundled module. The first-party esign ZAP server layer
// is .ts workspace source that cannot resolve as a package subpath at runtime,
// so it has to be bundled; @zap-proto/web stays an external registry dep.
//
// The v2 REST surface is NOT served here. It is a Hono app (../api/v2), because
// the published contract needs path parameters, GET, and multipart bodies.
export { serveZap } from '@hanzo/esign-trpc/zap/server';
