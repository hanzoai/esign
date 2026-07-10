// Package sign embeds the Hanzo Sign goja bundle so the unified hanzoai/cloud
// binary can serve /v1/sign/* in-process via the dop251/goja engine, without a
// Next.js/Remix runtime or Prisma/Postgres (HIP-0106, task #100).
//
// The TypeScript/Remix app remains the primary artifact and reference for the
// domain. This Go file is a read-only embed:
//
//   - Bundle() returns goja/bundle.js — the self-contained, ESM-free port of the
//     server-side e-signature flow (documents, recipients, fields, signing
//     state machine, audit trail, completion) exposing globalThis.handle(req).
//
// The bundle carries LOGIC only. Its two host capabilities — a per-tenant
// Base/SQLite store (globalThis.db) and the PDF/PKI signing primitives
// (globalThis.pdf) — are injected by the Go host in
// github.com/hanzoai/cloud/clients/sign. See goja/README.md for the contract.
package sign

import "embed"

//go:embed goja/bundle.js
var assets embed.FS

// Bundle returns the goja bundle source (goja/bundle.js). The host compiles this
// once and runs it on each pooled goja runtime.
func Bundle() ([]byte, error) {
	return assets.ReadFile("goja/bundle.js")
}
