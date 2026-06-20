import { type RawBuilder, sql } from 'kysely';

/**
 * SQLite SQL fragments for the analytics queries.
 *
 * Prisma stores `DateTime` columns in SQLite as epoch-millisecond INTEGERs, so
 * date functions must divide by 1000 and use the `'unixepoch'` modifier. These
 * helpers are the single source of the Postgres → SQLite rewrites (`DATE_TRUNC`
 * → `strftime`) used by the admin / growth aggregates.
 */

/** Month-truncated date as `YYYY-MM-01` for an epoch-ms DateTime column. */
export const monthTrunc = (column: string): RawBuilder<string> =>
  sql<string>`strftime('%Y-%m-01', ${sql.ref(column)} / 1000, 'unixepoch')`;

/**
 * A `Date` as the epoch-millisecond integer Prisma stores `DateTime` columns
 * as in SQLite. prisma-kysely types those columns as `string`, so a raw `Date`
 * operand fails to type-check; this binds the epoch integer (typed to match the
 * column) which SQLite compares correctly against the stored value. Use in
 * Kysely comparisons:
 *
 *   .where('Recipient.signedAt', '>', epochMs(fifteenMinutesAgo))
 */
export const epochMs = (date: Date): RawBuilder<string> => sql<string>`${date.getTime()}`;
