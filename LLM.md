# Hanzo Sign

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

## Key Files
- `README.md` -- Project documentation
- `package.json` -- Dependencies and scripts

## In-process cloud fold (HIP-0106, task #100)
The core server-side e-signature flow is ALSO shipped as a self-contained,
ESM-free **goja bundle** so the unified `hanzoai/cloud` binary runs it in-process
(TS-on-`dop251/goja` + Hanzo Base/SQLite) — no Next.js/Remix, no Prisma, no
Postgres. This replaces the standalone esign pod.

- `goja/bundle.js` — the ported domain: documents, recipients, fields, the
  signing flow/state machine, audit trail and completion. Exposes
  `globalThis.handle({route,method,params,body,tenant})`. It carries LOGIC only.
- `embed.go` / `go.mod` — a std-lib-only Go module (`github.com/hanzoai/sign`,
  `Bundle()`) that cloud imports to `go:embed` the bundle.
- `goja/README.md` — the host contract. Persistence (`globalThis.db`) and the
  PDF/PKI seal primitives (`globalThis.pdf`: pdfcpu render + x509/PKCS#7 sign)
  are injected by `hanzoai/cloud/clients/sign` as Go host-functions; only the
  crypto/PDF primitive is Go, the flow stays here in JS.

Edit a server-side rule? Mirror it in `goja/bundle.js` (the cloud path) as well
as the Remix/tRPC handlers.
