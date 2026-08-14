import { DocumentStatus, EnvelopeType } from '@prisma/client';

import type { DateRange } from '@hanzo/esign-lib/types/search-params';
import { kyselyPrisma, sql } from '@hanzo/esign-prisma';

export type OrganisationInsights = {
  id: number;
  name: string;
  signingVolume: number;
  // Kysely surfaces the epoch-ms `createdAt` DateTime column as a string for
  // SQLite; consumers wrap it in `new Date(...)` before formatting.
  createdAt: string;
  customerId: string | null;
  subscriptionStatus?: string;
  teamCount?: number;
  memberCount?: number;
};

export type GetSigningVolumeOptions = {
  search?: string;
  page?: number;
  perPage?: number;
  sortBy?: 'name' | 'createdAt' | 'signingVolume';
  sortOrder?: 'asc' | 'desc';
};

export async function getSigningVolume({
  search = '',
  page = 1,
  perPage = 10,
  sortBy = 'signingVolume',
  sortOrder = 'desc',
}: GetSigningVolumeOptions) {
  const offset = Math.max(page - 1, 0) * perPage;

  // Case-insensitive name search. SQLite has no `ILIKE`; `LIKE` is
  // case-insensitive only for ASCII and that fold is asymmetric on mixed-case
  // data, so we fold BOTH sides explicitly with `LOWER(...)` and a lowered
  // needle. This reproduces Postgres `ILIKE` for ASCII names exactly.
  //
  // LIMITATION (honest): SQLite's built-in `LOWER`/`LIKE`/`COLLATE NOCASE` are
  // ASCII-only — `LOWER('JOSÉ')` is `josÉ`, not `josé`. Non-ASCII names
  // (José, Müller) match case-SENSITIVELY here. True Unicode case-folding needs
  // the ICU extension, which better-sqlite3 does not bundle; enabling it is a
  // separate build/runtime decision, not a one-line change. Org/team name
  // search is admin-only and best-effort, so ASCII folding is the chosen
  // trade-off rather than a silent regression.
  const needle = `%${search.toLowerCase()}%`;

  let findQuery = kyselyPrisma.$kysely
    .selectFrom('Organisation as o')
    .where((eb) =>
      eb.or([
        eb(sql`lower(o.name)`, 'like', needle),
        eb.exists(
          eb
            .selectFrom('Team as t')
            .whereRef('t.organisationId', '=', 'o.id')
            .where(sql`lower(t.name)`, 'like', needle)
            .select(sql.lit(1).as('one')),
        ),
      ]),
    )
    .select((eb) => [
      'o.id as id',
      'o.createdAt as createdAt',
      'o.customerId as customerId',
      sql<string>`COALESCE(o.name, 'Unknown')`.as('name'),
      eb
        .selectFrom('Envelope as e')
        .innerJoin('Team as t', 't.id', 'e.teamId')
        .whereRef('t.organisationId', '=', 'o.id')
        .where('e.status', '=', sql.lit(DocumentStatus.COMPLETED))
        .where('e.deletedAt', 'is', null)
        .where('e.type', '=', sql.lit(EnvelopeType.DOCUMENT))
        .select(sql<number>`count(e.id)`.as('count'))
        .as('signingVolume'),
    ]);

  switch (sortBy) {
    case 'name':
      findQuery = findQuery.orderBy('name', sortOrder);
      break;
    case 'createdAt':
      findQuery = findQuery.orderBy('createdAt', sortOrder);
      break;
    case 'signingVolume':
      findQuery = findQuery.orderBy('signingVolume', sortOrder);
      break;
    default:
      findQuery = findQuery.orderBy('signingVolume', 'desc');
  }

  findQuery = findQuery.limit(perPage).offset(offset);

  const countQuery = kyselyPrisma.$kysely
    .selectFrom('Organisation as o')
    .where((eb) =>
      eb.or([
        eb(sql`lower(o.name)`, 'like', needle),
        eb.exists(
          eb
            .selectFrom('Team as t')
            .whereRef('t.organisationId', '=', 'o.id')
            .where(sql`lower(t.name)`, 'like', needle)
            .select(sql.lit(1).as('one')),
        ),
      ]),
    )
    .select(({ fn }) => [fn.countAll().as('count')]);

  const [results, [{ count }]] = await Promise.all([findQuery.execute(), countQuery.execute()]);

  return {
    organisations: results,
    totalPages: Math.ceil(Number(count) / perPage),
  };
}

export type GetOrganisationInsightsOptions = GetSigningVolumeOptions & {
  dateRange?: DateRange;
  startDate?: Date;
  endDate?: Date;
};

export async function getOrganisationInsights({
  search = '',
  page = 1,
  perPage = 10,
  sortBy = 'signingVolume',
  sortOrder = 'desc',
  dateRange = 'last30days',
  startDate,
  endDate,
}: GetOrganisationInsightsOptions) {
  const offset = Math.max(page - 1, 0) * perPage;

  const now = new Date();
  let dateCondition = sql<boolean>`1=1`;

  if (startDate && endDate) {
    dateCondition = sql<boolean>`e."createdAt" >= ${startDate} AND e."createdAt" <= ${endDate}`;
  } else {
    switch (dateRange) {
      case 'last30days': {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateCondition = sql<boolean>`e."createdAt" >= ${thirtyDaysAgo}`;
        break;
      }
      case 'last90days': {
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        dateCondition = sql<boolean>`e."createdAt" >= ${ninetyDaysAgo}`;
        break;
      }
      case 'lastYear': {
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        dateCondition = sql<boolean>`e."createdAt" >= ${oneYearAgo}`;
        break;
      }
      case 'allTime':
      default:
        dateCondition = sql<boolean>`1=1`;
        break;
    }
  }

  // Case-insensitive name search — see `getSigningVolume` above for the
  // ASCII-fold rationale and the Unicode limitation.
  const needle = `%${search.toLowerCase()}%`;

  let findQuery = kyselyPrisma.$kysely
    .selectFrom('Organisation as o')
    .leftJoin('Subscription as s', 'o.id', 's.organisationId')
    .where((eb) =>
      eb.or([
        eb(sql`lower(o.name)`, 'like', needle),
        eb.exists(
          eb
            .selectFrom('Team as t')
            .whereRef('t.organisationId', '=', 'o.id')
            .where(sql`lower(t.name)`, 'like', needle)
            .select(sql.lit(1).as('one')),
        ),
      ]),
    )
    .select((eb) => [
      'o.id as id',
      'o.createdAt as createdAt',
      'o.customerId as customerId',
      sql<string>`COALESCE(o.name, 'Unknown')`.as('name'),
      sql<string>`CASE WHEN s.status IS NOT NULL THEN s.status ELSE NULL END`.as(
        'subscriptionStatus',
      ),
      eb
        .selectFrom('Team as t')
        .whereRef('t.organisationId', '=', 'o.id')
        .select(sql<number>`count(t.id)`.as('count'))
        .as('teamCount'),
      eb
        .selectFrom('OrganisationMember as om')
        .whereRef('om.organisationId', '=', 'o.id')
        .select(sql<number>`count(om.id)`.as('count'))
        .as('memberCount'),
      eb
        .selectFrom('Envelope as e')
        .innerJoin('Team as t', 't.id', 'e.teamId')
        .whereRef('t.organisationId', '=', 'o.id')
        .where('e.status', '=', sql.lit(DocumentStatus.COMPLETED))
        .where('e.deletedAt', 'is', null)
        .where('e.type', '=', sql.lit(EnvelopeType.DOCUMENT))
        .where(dateCondition)
        .select(sql<number>`count(e.id)`.as('count'))
        .as('signingVolume'),
    ]);

  switch (sortBy) {
    case 'name':
      findQuery = findQuery.orderBy('name', sortOrder);
      break;
    case 'createdAt':
      findQuery = findQuery.orderBy('createdAt', sortOrder);
      break;
    case 'signingVolume':
      findQuery = findQuery.orderBy('signingVolume', sortOrder);
      break;
    default:
      findQuery = findQuery.orderBy('signingVolume', 'desc');
  }

  findQuery = findQuery.limit(perPage).offset(offset);

  const countQuery = kyselyPrisma.$kysely
    .selectFrom('Organisation as o')
    .where((eb) =>
      eb.or([
        eb(sql`lower(o.name)`, 'like', needle),
        eb.exists(
          eb
            .selectFrom('Team as t')
            .whereRef('t.organisationId', '=', 'o.id')
            .where(sql`lower(t.name)`, 'like', needle)
            .select(sql.lit(1).as('one')),
        ),
      ]),
    )
    .select(({ fn }) => [fn.countAll().as('count')]);

  const [results, [{ count }]] = await Promise.all([findQuery.execute(), countQuery.execute()]);

  return {
    organisations: results,
    totalPages: Math.ceil(Number(count) / perPage),
  };
}
