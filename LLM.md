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
- A recipient has no account. The `/zap` socket opens without a session for the
  app's own pages as an anonymous connection (`mint.ts`), and the dispatcher lets
  it reach only `publicRoutes` (`zap/server/public-routes.ts`: the routes tRPC
  served as public procedures, each authorised by the token it carries; their
  handlers take `ZapConnectionContext`). Before this the socket refused them and
  no recipient without an account could sign a field. `/v1/rpc` still needs a
  token. `packages/trpc/__tests__/anonymous.test.ts` holds it.
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

## The look: hanzo.ai's

- Tokens are `packages/ui/styles/theme.css`, values from @hanzo/ui DESIGN.md: dark is a
  #000 page, #0a0a0a surfaces, #171717 raised, #ededf1 ink, hairlines at white 10% (a
  control's edge 15%); light is white, #0a0a0a ink, black 10% and 15%. Every value is an
  opaque `H S% L%` triplet, because the Tailwind colours are `hsl(var(--x))` and an alpha
  inside the variable breaks every `/50` modifier. Monochrome: the recipient tones and the
  destructive red are the only colour, and both are functional.
- Type is Zen and Zen Mono from `@hanzo/font` (`app.css` imports `@hanzo/font/css`), with
  Zen's weight ladder in `packages/tailwind-config` (normal 497, medium 606, semibold 680,
  bold 760). The server-side PDF renderers keep their own Inter files in `public/fonts`.
- Buttons are pills (`packages/ui/primitives/button.tsx`); the primary is the ink colour,
  white on black or black on white. A tall option card built from a Button says
  `rounded-2xl` itself.
- The brand is the wordmark alone, as text: `BrandingLogo` renders
  `NEXT_PUBLIC_APP_NAME` (default "Hanzo eSign", `components/branding/brand.ts`) and is
  sized by the caller's `text-*` class, so no tenant name is clipped. There is no mark.
  Emails and the sealed PDF's certificate and audit log draw `public/static/logo.png`
  (copy in `packages/assets/static`), a raster of the same wordmark in Zen; redraw it if
  the default name changes.
- `PublicHeader` (in `app-header.tsx`) and `AppFooter` frame every page a visitor without
  a session sees: sign-in and the other unauthenticated pages, a recipient's result
  pages (`/sign/<token>/complete`, expired, rejected, waiting) and public profiles. The
  signing and direct-template pages keep their own bar and no footer.
- Theme: a stored choice (`/v1/theme`) wins; with none, remix-themes follows the device,
  dark unless it asks for light, as hanzo.ai does.
- Prettier's Tailwind plugin finds the hoisted Tailwind 4 and fails on this tree; format
  with a config that sets `tailwindConfig` to `apps/remix/tailwind.config.ts`.

## One way in: an IAM application's token
People sign in; the API is for services. A call without a session carries a Hanzo IAM
ACCESS token (`tokenType` access-token, never a sign-in's id_token) that an APPLICATION
minted for this app: signed by a key in hanzo.id's JWKS, issued by hanzo.id, `aud` =
`IAM_CLIENT_ID` (RFC 8707 `resource`), unexpired (`server-only/iam/token.ts`,
`verifyIamToken`). `public-api/get-bearer.ts` is the one resolver behind `/v1/rpc`
(mint.ts), `/v1/rest` and the download routes, and this server mints no tokens of its own.

`IAM_APP_TEAMS` (`<client id>:<team url>`, comma-separated) is the whole grant: the
token's `azp` must be listed, and the application acts for exactly that one team, as
its organisation owner, audited under its IAM subject (`admin/hanzo-cloud`). Since
`resource` lets any authenticated client mint `aud` = this app, the audience proves
nothing alone; the list does. Empty is nobody.

The other way round, this app calls the Hanzo API as itself: `Machine` mints its
client_credentials token for the Hanzo API (`resource` https://api.hanzo.ai), never for
itself, and refuses any bearer its own client minted. notify takes it, and so does a
webhook whose URL `HANZO_WEBHOOKS` lists exactly (`webhooks/send.ts`, the one sender for
sends and resends), so the receiver verifies eSign against hanzo.id and holds no secret;
what it answers is not kept for the team to read. A webhook anywhere else is sent no
identity, only its own secret: a team chooses where its webhook points. Zapier, which could only carry an API token, is gone.
An API token is still read in exactly one place: embed authoring signs its presign
token with one (`embedding-presign/api-token.ts`).

## Shipping and what is still broken
- The pin is universe `charts/app/values/hanzo/sign.yaml` (image
  `oci.hanzo.ai/hanzoai/esign:<semver>@<digest>`; CI publishes
  `ghcr.io/hanzoai/esign:<semver>` and `sha-<short>-amd64` through the door). CD
  syncs `hanzo-sign` only by hand: `POST /v1/platform/apps/sign/sync?org=hanzo` as
  admin. The signing certificate is the KMSSecret `sign-env-kms-sync` (KMS hanzo
  `/sign@prod`), read by the operator under its grant in `kms-grants.yaml`.
- The investor SAFE template is built from hanzoai/deck `safe/`; the intake that
  sends it is hanzo-inc/cloud `POST /v1/marketing/leads` (program `investor`), calling
  `/v1/rpc` as cloud's own IAM application, which `IAM_APP_TEAMS` maps to the team
  that holds the template. The team's webhook posts back to
  `/v1/marketing/leads/esign` as this app's IAM identity.
- Broken, found and not fixed: deleting an account fails ("Deleted account service
  account not found"): the SQLite `0_init` never created the deleted-account
  service user the delete hands envelopes to. `/admin/documents/<id>` answers 500.
  On `/v1/rpc` the admin routes' operationIds (`admin.documentDelete`) are not the
  handler names (`admin.document.delete`), so they 404; the socket reaches them.
