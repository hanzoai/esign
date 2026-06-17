# LLM.md - Hanzo eSign

## Overview
The Open Source DocuSign Alternative.

## Tech Stack
- **Language**: TypeScript/JavaScript

## Build & Run
```bash
npm install && npm run build
npm test
```

## Structure
```
sign/
  AGENTS.md
  ARCHITECTURE.md
  CLA.md
  CODE_OF_CONDUCT.md
  CODE_STYLE.md
  CONTRIBUTING.md
  LICENSE
  LLM.md
  MANIFEST.md
  README.md
  SIGNING.md
  WRITING_STYLE.md
  apps/
  assets/
  build.log
```

## RPC: tRPC → @zap-proto/web migration (in progress)

esign is migrating its RPC layer off tRPC onto `@zap-proto/web` (native ZAP
envelopes over WebSocket binary frames; NOT Cap'n Proto, NOT JSON-RPC). The
new layer lives in `packages/trpc/zap/` and coexists with the legacy tRPC
stack until all routers are ported.

- `zap/schema/*.zap` — ZAP schemas (struct-only; `zapgen --target=ts` emits
  `zap/gen/*_zap.ts`). `transport.zap` is the generic ZapRequest/ZapReply
  envelope; folder/profile/api_token have typed scalar structs; the rest are
  stubs until ported.
- `zap/server/` — `serveZap(httpServer)` attaches the WS endpoint to the Remix
  Node http.Server (one port). `mint.ts` is the single auth boundary (session
  cookie or API-token bearer → ZapContext, or 401) replacing tRPC's
  `authenticatedMiddleware`. `dispatch.ts` routes by "<router>.<procedure>".
- `zap/client/` + `zap/react/` — browser `zapCall()` + `useZapQuery`/
  `useZapMutation` (react-query wrappers; the only two hooks, NOT a tRPC clone).
- Payloads ride as SuperJSON strings (the same transformer tRPC used), so
  typed-object semantics are preserved; the wire is binary ZAP.
- Regenerate bindings: `zapgen -target=ts -out zap/gen zap/schema/<f>.zap`
  (zapgen = `~/work/zap-proto/go/cmd/zapgen`).
- Ported: folder (6/6), profile (5/5), apiToken (3/3). OpenAPI surface
  (`trpc-to-openapi`) is unaffected and stays on tRPC — ZAP has no OpenAPI
  mirror; that is a separate migration.

## Key Files
- `README.md` -- Project documentation
- `package.json` -- Dependencies and scripts
