/// <reference types="@hanzo/sign-tsconfig/process-env.d.ts" />

// Database URL resolution lives in `./tenant.ts` (per-tenant SQLite via Base).
// Kept as a thin re-export so the historical `getDatabaseUrl` name resolves to
// the single source of truth rather than re-deriving a URL here.
export { tenantDatabaseUrl as getDatabaseUrl } from './tenant';
