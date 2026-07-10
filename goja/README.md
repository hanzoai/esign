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
runs in goja. It runs on the **reusable `clients/gojabase` read-write-Base host**
(the same binding the captable pilot established) — the two things goja cannot do
are injected by that host:

- **Persistence** — `globalThis.__db` (per-tenant Hanzo Base/SQLite, one
  transaction per dispatch), NOT Prisma.
- **PDF + PKI** — `globalThis.__pdf` (real x509/PKCS#7 signing + pdfcpu
  rendering), injected by `clients/sign` via gojabase `Config.HostFns`, NOT
  `pdf-lib`/`node:crypto`.

## Host contract

```
globalThis.__db.query(sql, args) -> rows[]                 // gojabase, per-tenant Base/SQLite
globalThis.__db.exec(sql, args)  -> { changes, lastId }    // (one txn per dispatch; commits iff status<400)
globalThis.__newId()             -> crypto-random id
globalThis.__now()               -> unix milliseconds
globalThis.__pdf.stamp(pdfBase64, stampsJSON) -> pdfBase64        // render field values (pdfcpu)
globalThis.__pdf.sign(pdfBase64)              -> signedPdfBase64  // x509/PKCS#7 seal (digitorus/pdfsign)
globalThis.handle({ route, params, query, orgId, body }) -> { status, body }
```

`clients/gojabase` provides `__db`/`__newId`/`__now` + the per-tenant SQLite file
+ the request transaction; `clients/sign` provides the `sign.db` schema and the
`__pdf` host-functions, maps `/v1/sign/*` HTTP routes to bundle route names, and
calls `handle()` per request.

## Tenancy

The host binds `__db` to the caller's tenant DB **before** calling `handle` — from
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
