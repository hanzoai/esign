/// <reference types="@hanzo/sign-tsconfig/process-env.d.ts" />

/**
 * Database resolution for the Base SQLite store.
 *
 * esign is a single-binary multi-tenant app. Identity is global: a `User` owns
 * and belongs to MANY organisations (`User.ownedOrganisations[]` /
 * `organisationMember[]`), and `Session` / `Account` / `Passkey` / `ApiToken`
 * carry no `organisationId`. Auth is resolved BEFORE any org is known —
 * `validateSessionToken` reads `Session` to discover the user — so a database
 * cannot be selected per-org at request entry (the chicken-and-egg the prior
 * file-per-org design could never satisfy). Only 6 of 47 tables even carry an
 * `organisationId`; the rest scope through relations (`Envelope → Team →
 * Organisation`) that a per-file split would make un-joinable.
 *
 * Therefore there is ONE Base SQLite database. Tenant isolation is enforced
 * where it has always lived in this schema: row-level org/team scoping in the
 * `packages/lib/server-only/*` handlers — every cross-org read funnels through
 * the single `buildTeamWhereQuery({ teamId, userId })` predicate keyed on the
 * authenticated user, never on a client-supplied value. That predicate, not a
 * filesystem boundary, is the isolation boundary. See
 * `packages/prisma/__tests__/tenant-isolation.test.ts` for the proof that a
 * forged team/org id returns zero rows.
 *
 * This module owns the ONE place a SQLite connection URL is constructed, and
 * fails closed if it cannot be resolved unambiguously.
 */

// Org ids are slugs derived from the IAM `owner` claim. Even though routing is
// no longer per-file, this validator is the canonical org-id guard reused by
// the backfill (which DOES write one file per org) and any code that derives a
// filesystem path from an org id — it rejects anything that could escape a
// directory root (path traversal / absolute paths) so a hostile claim can never
// address another tenant's file or the filesystem.
const ORG_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export const assertValidOrgId = (orgId: string): string => {
  if (!ORG_ID_PATTERN.test(orgId)) {
    throw new Error(`Invalid tenant org id: ${JSON.stringify(orgId)}`);
  }

  return orgId;
};

/**
 * The Prisma datasource URL for the Base SQLite store.
 *
 * Single source of truth: `DATABASE_URL`. Fails closed when unset — there is no
 * implicit fallback path that could silently point production at the wrong
 * file. `?connection_limit=1` keeps one writer; SQLite serialises writes and a
 * larger pool only produces `SQLITE_BUSY`.
 */
export const databaseUrl = (): string => {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is not set — cannot resolve the SQLite database.');
  }

  // A bare `file:` SQLite URL takes Prisma connection params as query string.
  // Append the single-writer limit unless the caller already specified one.
  if (url.startsWith('file:') && !url.includes('connection_limit')) {
    return `${url}${url.includes('?') ? '&' : '?'}connection_limit=1`;
  }

  return url;
};
