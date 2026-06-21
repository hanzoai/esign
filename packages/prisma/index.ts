/// <reference types="@hanzo/sign-prisma/types/types.d.ts" />
import { Prisma, PrismaClient } from '@prisma/client';
import type { Role, WebhookTriggerEvents } from '@prisma/client';
import { Kysely, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler } from 'kysely';
import kyselyExtension from 'prisma-extension-kysely';

import type { DB } from './generated/types';
import { decodeList, encodeListFields } from './json-array';
import { databaseUrl } from './tenant';
import { remember } from './utils/remember';

/**
 * Base SQLite store. One process-wide Prisma client bound to `DATABASE_URL`
 * (see `./tenant.ts`). Tenant isolation is row-level org/team scoping in the
 * `server-only/*` handlers, not a per-connection database — identity is global
 * here (a user spans many orgs), so the database cannot be chosen per request.
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
        encodeListFields('OrganisationAuthenticationPortal', args),
        query(args)
      ),
    },
  },
});

const buildClient = () =>
  new PrismaClient({ datasourceUrl: databaseUrl() }).$extends(listFieldExtension);

/** The extended client type, carrying the list-field array result types. */
export type ExtendedPrismaClient = ReturnType<typeof buildClient>;

/** The single process-wide client, built + memoised on first use. */
const client = (): ExtendedPrismaClient => remember('prisma', buildClient);

// Accessor proxy so importing this module does NOT open a DB connection — the
// client is constructed lazily on the first property access. This keeps `import
// { prisma }` side-effect-free for tooling/tests and lets DATABASE_URL be set
// before the first query. The 300+ `prisma.foo.bar()` call sites are unchanged.
export const prisma: ExtendedPrismaClient = new Proxy({} as ExtendedPrismaClient, {
  get(_t, prop, receiver) {
    const c = client();
    const value = Reflect.get(c as object, prop, receiver);
    return typeof value === 'function' ? value.bind(c) : value;
  },
  has(_t, prop) {
    return Reflect.has(client() as object, prop);
  },
}) as ExtendedPrismaClient;

// Kysely over the same client, with the SQLite dialect. Also lazy.
const buildKysely = () =>
  client().$extends(
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
  get(_t, prop, receiver) {
    const c = remember('kyselyPrisma', buildKysely);
    const value = Reflect.get(c as object, prop, receiver);
    return typeof value === 'function' ? value.bind(c) : value;
  },
}) as KyselyClient;

export { sql } from 'kysely';
export { monthTrunc, epochMs } from './sqlite-sql';
