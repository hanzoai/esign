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
 * file-per-org design could never satisfy). Only 8 of 47 tables even carry an
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
