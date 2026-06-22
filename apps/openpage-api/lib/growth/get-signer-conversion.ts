import { DateTime } from 'luxon';

import { kyselyPrisma, monthTrunc } from '@hanzo/esign-prisma';

import { addZeroMonth } from '../add-zero-month';

export const getSignerConversionMonthly = async (type: 'count' | 'cumulative' = 'count') => {
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

  const transformedData = {
    labels: result
      .map((row) => DateTime.fromFormat(row.month, 'yyyy-MM-dd').toFormat('MMM yyyy'))
      .reverse(),
    datasets: [
      {
        label: type === 'count' ? 'Signers That Signed Up' : 'Total Signers That Signed Up',
        data: result
          .map((row) => (type === 'count' ? Number(row.count) : Number(row.cume_count)))
          .reverse(),
      },
    ],
  };

  return addZeroMonth(transformedData, type === 'cumulative');
};

export type GetSignerConversionMonthlyResult = Awaited<
  ReturnType<typeof getSignerConversionMonthly>
>;
