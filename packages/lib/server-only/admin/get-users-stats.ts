import { DateTime } from 'luxon';

import { kyselyPrisma, monthTrunc, prisma, sql } from '@hanzo/sign-prisma';
import { SubscriptionStatus, UserSecurityAuditLogType } from '@hanzo/sign-prisma/client';

export const getUsersCount = async () => {
  return await prisma.user.count();
};

export const getOrganisationsWithSubscriptionsCount = async () => {
  return await prisma.organisation.count({
    where: {
      subscription: {
        status: SubscriptionStatus.ACTIVE,
      },
    },
  });
};

export type GetUserWithDocumentMonthlyGrowth = Array<{
  month: string;
  count: number;
  signed_count: number;
}>;

type GetUserWithDocumentMonthlyGrowthQueryResult = Array<{
  month: string;
  count: bigint;
  signed_count: bigint;
}>;

export const getUserWithSignedDocumentMonthlyGrowth = async () => {
  // SQLite: epoch-ms DateTime truncated to month via strftime; enum columns are
  // TEXT so values compare directly with no dialect cast.
  const result = await prisma.$queryRaw<GetUserWithDocumentMonthlyGrowthQueryResult>`
      SELECT
        strftime('%Y-%m-01', "Envelope"."createdAt" / 1000, 'unixepoch') AS "month",
        COUNT(DISTINCT "Envelope"."userId") as "count",
        COUNT(DISTINCT CASE WHEN "Envelope"."status" = 'COMPLETED' THEN "Envelope"."userId" END) as "signed_count"
      FROM "Envelope"
      INNER JOIN "Team" ON "Envelope"."teamId" = "Team"."id"
      INNER JOIN "Organisation" ON "Team"."organisationId" = "Organisation"."id"
      WHERE "Envelope"."type" = 'DOCUMENT'
      GROUP BY "month"
      ORDER BY "month" DESC
      LIMIT 12
`;

  return result.map((row) => ({
    month: DateTime.fromFormat(row.month, 'yyyy-MM-dd').toFormat('yyyy-MM'),
    count: Number(row.count),
    signed_count: Number(row.signed_count),
  }));
};

export type GetMonthlyActiveUsersResult = Array<{
  month: string;
  count: number;
  cume_count: number;
}>;

export const getMonthlyActiveUsers = async () => {
  // SQLite month truncation; enum column is TEXT so it compares directly.
  const monthExpr = monthTrunc('UserSecurityAuditLog.createdAt');

  const qb = kyselyPrisma.$kysely
    .selectFrom('UserSecurityAuditLog')
    .select(({ fn }) => [
      monthExpr.as('month'),
      fn.count('userId').distinct().as('count'),
      fn
        .sum(fn.count('userId').distinct())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
        .over((ob) => ob.orderBy(monthExpr as any))
        .as('cume_count'),
    ])
    .where('UserSecurityAuditLog.type', '=', sql.lit(UserSecurityAuditLogType.SIGN_IN))
    .groupBy(monthExpr)
    .orderBy('month', 'desc')
    .limit(12);

  const result = await qb.execute();

  return result.map((row) => ({
    month: DateTime.fromFormat(row.month, 'yyyy-MM-dd').toFormat('yyyy-MM'),
    count: Number(row.count),
    cume_count: Number(row.cume_count),
  }));
};
