/// <reference types="@hanzo/sign-tsconfig/process-env.d.ts" />
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';

/**
 * Per-tenant SQLite via Hanzo Base.
 *
 * Each organisation owns its own `sign.db` SQLite file under `BASE_PATH`:
 *
 *   ${BASE_PATH}/${orgId}/sign.db
 *
 * Tenant routing is request-scoped through {@link tenantStorage} (an
 * `AsyncLocalStorage`). The `prisma` / `kyselyPrisma` exports resolve, per
 * access, to the client bound to the org in the active context. Out-of-band
 * callers (CLI migrations, background jobs, dev) run without a context and
 * fall through to the single-file `DATABASE_URL` (the Prisma CLI target).
 *
 * This is the one place that maps (org → SQLite file). Nothing else in the
 * codebase constructs a connection URL, so isolation is enforced at a single
 * boundary rather than smeared across call sites.
 */

export type TenantContext = {
  /** Organisation id — taken from the JWT `owner` claim. */
  orgId: string;
};

const tenantStorage = new AsyncLocalStorage<TenantContext>();

/** Run `fn` with `orgId` bound as the active tenant for all DB access within. */
export const runWithTenant = <T>(orgId: string, fn: () => T): T =>
  tenantStorage.run({ orgId }, fn);

/** The org bound in the current async context, or `undefined` out-of-band. */
export const getTenantOrgId = (): string | undefined => tenantStorage.getStore()?.orgId;

// Org ids are slugs derived from the IAM `owner` claim. Reject anything that
// could escape the BASE_PATH root (path traversal / absolute paths) so a
// hostile claim can never address another tenant's file or the filesystem.
const ORG_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export const assertValidOrgId = (orgId: string): string => {
  if (!ORG_ID_PATTERN.test(orgId)) {
    throw new Error(`Invalid tenant org id: ${JSON.stringify(orgId)}`);
  }

  return orgId;
};

const baseRoot = (): string => {
  const root = process.env.BASE_PATH;

  if (!root) {
    throw new Error('BASE_PATH is not set — cannot resolve per-tenant SQLite root.');
  }

  // Always absolute: a relative `file:` URL resolves against the schema dir for
  // the Prisma CLI but against cwd at runtime — resolving here makes both agree.
  return path.resolve(root);
};

/** Absolute SQLite file path for an org's database. */
export const tenantDbFile = (orgId: string): string =>
  path.join(baseRoot(), assertValidOrgId(orgId), 'sign.db');

/**
 * Prisma datasource URL for the active context.
 *
 * - In a tenant context → `file:${BASE_PATH}/${orgId}/sign.db`.
 * - Out-of-band → `DATABASE_URL` (the CLI / dev single-file target).
 *
 * `?connection_limit=1` keeps one writer per file; SQLite serialises writes
 * and a larger pool only produces `SQLITE_BUSY`.
 */
export const tenantDatabaseUrl = (): string => {
  const orgId = getTenantOrgId();

  if (orgId) {
    return `file:${tenantDbFile(orgId)}?connection_limit=1`;
  }

  const fallback = process.env.DATABASE_URL;

  if (!fallback) {
    throw new Error(
      'No tenant context and DATABASE_URL is unset — cannot resolve a SQLite database.',
    );
  }

  return fallback;
};

/** Cache key for the per-tenant client pool. */
export const tenantCacheKey = (): string => getTenantOrgId() ?? '__default__';
