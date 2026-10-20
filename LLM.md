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

## Routes: everything is /v1
Every route is served and called under /v1; `npm run lint:paths`, the first
step of the gate, fails on any other API prefix. The mount is
`apps/remix/server/router.ts`:

| path | what |
|---|---|
| `/v1/rest/*` | resource API, the ts-rest contract (`packages/api/v1`), spec at `/v1/rest/openapi.json` |
| `/v1/rpc/*` | operation API, ZAP over JSON-over-HTTP (`server/zap/http-api.ts`), spec at `/v1/rpc/openapi.json` |
| `/v1/auth/*` | session auth (`packages/auth/server`) |
| `/v1/files/*`, `/v1/ai/*`, `/v1/jobs/*` | uploads and downloads, AI detection, the job runner |
| `/v1/health`, `/v1/limits`, `/v1/locale`, `/v1/theme`, … | RR7 resource routes (`app/routes/v1+`) |
| `/auth/callback` | Hanzo IAM sign-in return |
| `/zap` | the browser's ZAP WebSocket |

The two REST surfaces are named for what they are, not versioned, so neither
shadows the other.
`/auth/callback` is the one browser callback path IAM derives for every host in
universe `charts/app/values/hanzo/iam-provision.yaml`, so the Hanzo
sign-in needs no per-app redirect_uri; other OAuth providers return to
`/v1/auth/callback/<provider>`.

## Inside a transaction, only `tx`
Base SQLite serves one write connection. `prisma.$transaction(async (tx) => …)`
holds it for as long as the callback runs, so a call in the callback that
reaches the global Prisma client queues behind a lock that call is itself
blocking. It waits out the busy timeout and the transaction dies with `P2028
Transaction already closed` — at runtime, on a green build. This is what stopped
every document creation at 0.1.4.

Mail and other calls out of the process do not deadlock, but they hold that one
connection open across the network: every other write waits on a mail server,
and a slow send reaches the same timeout by a longer road.

Jobs, webhooks, notifications and mail are side effects of committed state:
return what they need from the callback and fire them after the commit. A
failed send therefore no longer rolls back the record it announces — the record
stands, and the send is reported where it happens. Where a transaction wrapped
one write and a send, it was doing nothing: keep the order, drop the
transaction, and a single write is still atomic on its own.

`packages/eslint-config/transaction.cjs` holds the rule. Two callers read it:
the shared config, so an editor says it while you type, and `npm run lint:tx`,
which runs it alone over every package and app in seconds and is the first
thing the CI gate does. `npm test -w @hanzo/esign-eslint-config` proves the
rule still fires, so it cannot rot into a no-op.

It asks three questions of a callback: is the client called `tx`, does the
callback name a client that is not `tx`, and does it await a call it did not
hand `tx`. The third is the general one — handing `tx` on is how a call says it
joins the transaction, so awaiting one that never mentions it is awaiting the
world outside while holding the door. That covers jobs, webhooks, mail and any
other I/O under one question, and it sees through a helper the earlier
name-matching could not: what is checked is the call site's shape, not its
callee's name.

## In-process cloud fold (HIP-0106, task #100)
The core server-side e-signature flow is ALSO shipped as a self-contained,
ESM-free **goja bundle** so the unified `hanzoai/cloud` binary runs it in-process
(TS-on-`dop251/goja` + Hanzo Base/SQLite) — no Next.js/Remix, no Prisma, no
Postgres. This replaces the standalone esign pod.

- `goja/bundle.js` — the ported domain: documents, recipients, fields, the
  signing flow/state machine, audit trail and completion. Exposes
  `globalThis.handle({route,method,params,body,tenant})`. It carries LOGIC only.
- `embed.go` / `go.mod` — a std-lib-only Go module (`github.com/hanzoai/esign`,
  `Bundle()`) that cloud imports to `go:embed` the bundle.
- `goja/README.md` — the host contract. It runs on the reusable
  `hanzoai/cloud/clients/gojabase` RW-Base host: persistence (`globalThis.__db`,
  per-tenant SQLite, one txn per dispatch) + `__newId`/`__now` come from gojabase;
  the PDF/PKI seal primitives (`globalThis.__pdf`: pdfcpu render + x509/PKCS#7
  sign) are injected by `clients/sign` via gojabase `Config.HostFns`. Only the
  crypto/PDF primitive is Go; the flow + seal orchestration stay here in JS.

Edit a server-side rule? Mirror it in `goja/bundle.js` (the cloud path) as well
as the Remix/tRPC handlers.

## Several recipients, and what a send needs in production
- cmdk 1 writes `data-disabled="false"` on every enabled item. `CommandItem`
  (`packages/ui/primitives/command.tsx`) disables only on `data-[disabled=true]`;
  matching the bare attribute made every combobox item ignore the mouse, so the
  fields step could not select a second recipient and the send refused for want
  of their signature field.
- The recipients form learns server ids only on a step change. The editor
  provider keeps them by the row's `formId`, sent as `clientId` and echoed back
  (`envelope.recipient.set`), so a recipient created by one autosave is updated,
  not deleted and recreated, by the next. `envelope-recipients.spec.ts`
  ("several recipients in one visit") holds both.
- Sealing a completed document signs it with the certificate the local signer
  reads: `NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS` (base64 p12) and
  `NEXT_PRIVATE_SIGNING_PASSPHRASE`, from KMS `hanzo/sign@prod`. The image has
  none; without them every completion fails at the seal. An unset
  `NEXT_PRIVATE_SIGNING_TRANSPORT` is `local` for the signer and for
  `/v1/health` alike.
- Mail goes through notify (`packages/email/transports/notify.ts`): the sender
  is the org's credential (no-reply@send.hanzo.ai), and notify carries no
  attachment and no reply-to. The completed email reaches every recipient with
  its download link (`/sign/<token>/complete`), not the PDF attached.
