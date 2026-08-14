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

## Inside a transaction, only `tx`
Base SQLite serves one write connection. `prisma.$transaction(async (tx) => …)`
holds it for as long as the callback runs, so a call in the callback that
reaches the global Prisma client queues behind a lock that call is itself
blocking. It waits out the busy timeout and the transaction dies with `P2028
Transaction already closed` — at runtime, on a green build. This is what stopped
every document creation at 0.1.4.

Jobs, webhooks, notifications and mail are side effects of committed state:
return what they need from the callback and fire them after the commit.

`packages/eslint-config/transaction.cjs` holds the rule. Two callers read it:
the shared config, so an editor says it while you type, and `npm run lint:tx`,
which runs it alone over every package and app in seconds and is the first
thing the CI gate does. `npm test -w @hanzo/esign-eslint-config` proves the
rule still fires, so it cannot rot into a no-op.

It reads the call site, not the call graph: a helper that reaches the global
client from its own body is invisible to it. Calling something inside a
transaction that you did not hand `tx` is the shape to distrust.

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
- `goja/README.md` — the host contract. It runs on the reusable
  `hanzoai/cloud/clients/gojabase` RW-Base host: persistence (`globalThis.__db`,
  per-tenant SQLite, one txn per dispatch) + `__newId`/`__now` come from gojabase;
  the PDF/PKI seal primitives (`globalThis.__pdf`: pdfcpu render + x509/PKCS#7
  sign) are injected by `clients/sign` via gojabase `Config.HostFns`. Only the
  crypto/PDF primitive is Go; the flow + seal orchestration stay here in JS.

Edit a server-side rule? Mirror it in `goja/bundle.js` (the cloud path) as well
as the Remix/tRPC handlers.
