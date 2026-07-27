// hanzoai/sign — Go embed module.
//
// This repo's PRIMARY artifact is the Hanzo Sign application (the Documenso
// fork: TypeScript/Remix + Prisma). This tiny Go module exists ONLY so the
// unified hanzoai/cloud binary (HIP-0106, task #100) can embed the ESM-free
// goja bundle (goja/bundle.js) — the port of the server-side e-signature domain
// (documents, recipients, fields, signing flow, audit trail, completion) — and
// run it in-process via dop251/goja, backed by Hanzo Base/SQLite. Cloud imports
// github.com/hanzoai/sign and gets Bundle().
//
// std-lib only — no third-party Go deps. The signing crypto/PDF primitives live
// in cloud (Go host-functions); this module carries only the domain bundle.
module github.com/hanzoai/sign

go 1.26.5
