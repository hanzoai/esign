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
- `LICENSE` -- AGPL-3.0, unmodified from upstream Documenso. Do not edit.
- `NOTICE` -- upstream attribution + record of Hanzo's modifications.

## Licensing — this is an AGPL fork, treat it as one
Upstream is **Documenso** (https://github.com/documenso/documenso), AGPL-3.0,
Copyright (c) 2022-present Documenso, Inc. and contributors. We keep AGPL-3.0
deliberately — this is one of only two repos in the estate that stays AGPL
(the other is `hanzoai/dataroom`). Everything original at Hanzo is Apache-2.0
or BSD-3-Clause instead.

Rules for anyone touching this repo:
- **Never edit `LICENSE`.** It is byte-for-byte upstream (created 51724a47f,
  2022-11-14). A rebranding sed pass must not touch it.
- Record any new modification category in `NOTICE`, not in a new markdown file.
- The full upstream git history is preserved on purpose — it is our attribution
  evidence. Never squash or rewrite it.

**AGPL §13 gap (open):** we serve this over the network at sign.hanzo.ai, so
users interacting with it remotely must be offered the Corresponding Source.
The running UI currently has **no source link** — `NOTICE` names the source URL
(github.com/hanzoai/sign) but nothing in the app surfaces it. Adding a visible
source link in the app footer is the outstanding fix.

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
