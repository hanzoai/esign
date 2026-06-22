import { DateTime } from 'luxon';

import { kyselyPrisma, monthTrunc } from '@hanzo/esign-prisma';

import { addZeroMonth } from '../add-zero-month';

export const getUserMonthlyGrowth = async (type: 'count' | 'cumulative' = 'count') => {
  // SQLite month truncation (epoch-ms DateTime → YYYY-MM-01 via strftime).
  const monthExpr = monthTrunc('User.createdAt');

  const qb = kyselyPrisma.$kysely
    .selectFrom('User')
    .select(({ fn }) => [
      monthExpr.as('month'),
      fn.count('id').as('count'),
      fn
        .sum(fn.count('id'))
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
        .over((ob) => ob.orderBy(monthExpr as any))
        .as('cume_count'),
    ])
    .groupBy('month')
    .orderBy('month', 'desc');

  const result = await qb.execute();

  const transformedData = {
    labels: result
      .map((row) => DateTime.fromFormat(row.month, 'yyyy-MM-dd').toFormat('MMM yyyy'))
      .reverse(),
    datasets: [
      {
        label: type === 'count' ? 'New Users' : 'Total Users',
        data: result
          .map((row) => (type === 'count' ? Number(row.count) : Number(row.cume_count)))
          .reverse(),
      },
    ],
  };

  return addZeroMonth(transformedData, type === 'cumulative');
};

export type GetUserMonthlyGrowthResult = Awaited<ReturnType<typeof getUserMonthlyGrowth>>;
