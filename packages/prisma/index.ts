/// <reference types="@hanzo/sign-prisma/types/types.d.ts" />
import { Prisma, PrismaClient } from '@prisma/client';
import type { Role, WebhookTriggerEvents } from '@prisma/client';
import { Kysely, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler } from 'kysely';
import kyselyExtension from 'prisma-extension-kysely';

import type { DB } from './generated/types';
import { decodeList, encodeListFields } from './json-array';
import { tenantCacheKey, tenantDatabaseUrl } from './tenant';
import { remember } from './utils/remember';

/**
 * Per-tenant SQLite (Hanzo Base). One client per org, cached by the active
 * tenant context. See `./tenant.ts` for how the org → file URL is resolved.
 * The default (`__default__`) client is bound to `DATABASE_URL` and serves
 * CLI / job / dev access that runs without a tenant context.
 */

// --- list-field codec extension -------------------------------------------
// The single bridge for the four columns that were Postgres arrays and are now
// JSON `TEXT` in SQLite. `result` decodes (and re-types) each column back to a
// typed array on read; `query` encodes arrays to JSON on every write. Written
// statically per model so Prisma infers the array result types end-to-end —
// `prisma.user.findX().roles` is `Role[]`, not `string`.

const listFieldExtension = Prisma.defineExtension({
  name: 'sqlite-list-fields',
  result: {
    user: {
      roles: {
        needs: { roles: true },
        compute: ({ roles }): Role[] => decodeList<Role>(roles),
      },
    },
    webhook: {
      eventTriggers: {
        needs: { eventTriggers: true },
        compute: ({ eventTriggers }): WebhookTriggerEvents[] =>
          decodeList<WebhookTriggerEvents>(eventTriggers),
      },
    },
    passkey: {
      transports: {
        needs: { transports: true },
        compute: ({ transports }): string[] => decodeList<string>(transports),
      },
    },
    organisationAuthenticationPortal: {
      allowedDomains: {
        needs: { allowedDomains: true },
        compute: ({ allowedDomains }): string[] => decodeList<string>(allowedDomains),
      },
    },
  },
  query: {
    user: {
      $allOperations: ({ args, query }) => (encodeListFields('User', args), query(args)),
    },
    webhook: {
      $allOperations: ({ args, query }) => (encodeListFields('Webhook', args), query(args)),
    },
    passkey: {
      $allOperations: ({ args, query }) => (encodeListFields('Passkey', args), query(args)),
    },
    organisationAuthenticationPortal: {
      $allOperations: ({ args, query }) => (
        encodeListFields('OrganisationAuthenticationPortal', args), query(args)
      ),
    },
  },
});

const buildClient = () =>
  new PrismaClient({ datasourceUrl: tenantDatabaseUrl() }).$extends(listFieldExtension);

/** The org-bound client type, carrying the list-field array result types. */
export type ExtendedPrismaClient = ReturnType<typeof buildClient>;

/** Resolve the client for the active tenant, lazily creating + caching. */
const tenantClient = (): ExtendedPrismaClient =>
  remember(`prisma:${tenantCacheKey()}`, buildClient);

// Stable accessor proxy: every property access routes to the current tenant's
// client, so the 300+ `prisma.foo.bar()` call sites need no changes and yet
// each request reads/writes only its own org's SQLite file.
export const prisma: ExtendedPrismaClient = new Proxy({} as ExtendedPrismaClient, {
  get(_target, prop, receiver) {
    const client = tenantClient();
    const value = Reflect.get(client as object, prop, receiver);

    return typeof value === 'function' ? value.bind(client) : value;
  },
  has(_target, prop) {
    return Reflect.has(tenantClient() as object, prop);
  },
}) as ExtendedPrismaClient;

// Kysely over the same per-tenant client, with the SQLite dialect. Cached
// per tenant alongside its `PrismaClient`.
const buildKysely = () =>
  tenantClient().$extends(
    kyselyExtension({
      kysely: (driver) =>
        new Kysely<DB>({
          dialect: {
            createAdapter: () => new SqliteAdapter(),
            createDriver: () => driver,
            createIntrospector: (db) => new SqliteIntrospector(db),
            createQueryCompiler: () => new SqliteQueryCompiler(),
          },
        }),
    }),
  );

type KyselyClient = ReturnType<typeof buildKysely>;

export const kyselyPrisma: KyselyClient = new Proxy({} as KyselyClient, {
  get(_target, prop, receiver) {
    const client = remember(`kyselyPrisma:${tenantCacheKey()}`, buildKysely);
    const value = Reflect.get(client as object, prop, receiver);

    return typeof value === 'function' ? value.bind(client) : value;
  },
}) as KyselyClient;

export { sql } from 'kysely';
export { monthTrunc, epochMs } from './sqlite-sql';
export { runWithTenant, getTenantOrgId, tenantDbFile } from './tenant';
