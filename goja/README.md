# `goja/` — Hanzo Sign inside the unified cloud binary

`bundle.js` is a **self-contained, ESM-free** port of the Hanzo Sign
(Documenso fork) **server-side** e-signature domain, authored so it runs
verbatim inside the [`dop251/goja`](https://github.com/dop251/goja) JavaScript
engine embedded in [`hanzoai/cloud`](https://github.com/hanzoai/cloud) per
HIP-0106 (task #100). It replaces the Next.js/Remix + tRPC + Prisma/Postgres
runtime for the core signing flow with **TS-on-goja + Hanzo Base/SQLite**.

## Why a bundle?

goja supports ES2020 but **not** ES-module `import`/`export` and **not**
`node:` builtins, Prisma, or `pdf-lib`. So the tRPC handlers cannot be loaded
directly. Instead, the **exact domain flow** — create → recipients → fields →
send → sign → complete → seal → audit — is ported here as one CommonJS IIFE and
runs in goja. The two things goja cannot do are injected by the Go host:

- **Persistence** — `globalThis.db` (Hanzo Base/SQLite), NOT Prisma.
- **PDF + PKI** — `globalThis.pdf` (real x509/PKCS#7 signing + pdfcpu rendering),
  NOT `@libpdf/core`/`node:crypto`.

## Host contract

```
globalThis.db  = { query(sql, params) -> rows[],
                   exec(sql, params)  -> { rowsAffected, lastInsertId } }   // pre-routed to the tenant DB
globalThis.pdf = { stamp(pdfBase64, stampsJSON) -> pdfBase64,               // render field values (pdfcpu)
                   sign(pdfBase64)             -> signedPdfBase64 }         // x509/PKCS#7 seal (digitorus/pdfsign)
globalThis.sys = { uuid() -> string, token() -> string, nowMs() -> number } // crypto/rand + clock
globalThis.handle({ route, method, params, query, body, tenant }) -> { status, body }
```

The Go wrapper (`hanzoai/cloud/clients/sign`) opens/migrates the per-tenant
`sign.db`, injects `db`/`pdf`/`sys`, maps `/v1/sign/*` HTTP routes to bundle
route names, and calls `handle()` per request.

## Tenancy

The host binds `db` to the caller's tenant DB **before** calling `handle` — from
the validated principal for owner routes (`/v1/sign/documents/*`), or from the
`:org` path segment for recipient token routes (`/v1/sign/o/:org/sign/:token`).
The bundle never chooses a tenant; isolation is a host property.

## Route names

| Route name | HTTP |
|---|---|
| `documents.create` | `POST /v1/sign/documents` |
| `documents.list` | `GET /v1/sign/documents` |
| `documents.get` | `GET /v1/sign/documents/:id` |
| `recipients.add` | `POST /v1/sign/documents/:id/recipients` |
| `fields.add` | `POST /v1/sign/documents/:id/fields` |
| `documents.send` | `POST /v1/sign/documents/:id/send` |
| `documents.download` | `GET /v1/sign/documents/:id/download` |
| `documents.audit` | `GET /v1/sign/documents/:id/audit` |
| `sign.view` | `GET /v1/sign/o/:org/sign/:token` |
| `sign.field` | `POST /v1/sign/o/:org/sign/:token/fields/:fieldId` |
| `sign.complete` | `POST /v1/sign/o/:org/sign/:token/complete` |
| `sign.reject` | `POST /v1/sign/o/:org/sign/:token/reject` |
