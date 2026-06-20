import { DateTime } from 'luxon';

import { kyselyPrisma, monthTrunc } from '@hanzo/sign-prisma';

export const getSignerConversionMonthly = async () => {
  // SQLite month truncation (epoch-ms DateTime → YYYY-MM-01 via strftime).
  const monthExpr = monthTrunc('User.createdAt');

  const qb = kyselyPrisma.$kysely
    .selectFrom('Recipient')
    .innerJoin('User', 'Recipient.email', 'User.email')
    .select(({ fn }) => [
      monthExpr.as('month'),
      fn.count('Recipient.email').distinct().as('count'),
      fn
        .sum(fn.count('Recipient.email').distinct())
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
        .over((ob) => ob.orderBy(monthExpr as any))
        .as('cume_count'),
    ])
    .where('Recipient.signedAt', 'is not', null)
    .where('Recipient.signedAt', '<', (eb) => eb.ref('User.createdAt'))
    .groupBy(monthExpr)
    .orderBy('month', 'desc');

  const result = await qb.execute();

  return result.map((row) => ({
    month: DateTime.fromFormat(row.month, 'yyyy-MM-dd').toFormat('yyyy-MM'),
    count: Number(row.count),
    cume_count: Number(row.cume_count),
  }));
};

export type GetSignerConversionMonthlyResult = Awaited<
  ReturnType<typeof getSignerConversionMonthly>
>;
