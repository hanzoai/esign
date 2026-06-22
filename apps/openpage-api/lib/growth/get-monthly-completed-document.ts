import { DocumentStatus, EnvelopeType } from '@prisma/client';
import { DateTime } from 'luxon';

import { kyselyPrisma, monthTrunc, sql } from '@hanzo/esign-prisma';

import { addZeroMonth } from '../add-zero-month';

export const getCompletedDocumentsMonthly = async (type: 'count' | 'cumulative' = 'count') => {
  // SQLite month truncation (epoch-ms DateTime → YYYY-MM-01 via strftime).
  const monthExpr = monthTrunc('Envelope.updatedAt');

  const qb = kyselyPrisma.$kysely
    .selectFrom('Envelope')
    .select(({ fn }) => [
      monthExpr.as('month'),
      fn.count('id').as('count'),
      fn
        .sum(fn.count('id'))
        // Feels like a bug in the Kysely extension but I just can not do this orderBy in a type-safe manner
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
        .over((ob) => ob.orderBy(monthExpr as any))
        .as('cume_count'),
    ])
    .where('Envelope.status', '=', sql.lit(DocumentStatus.COMPLETED))
    .where('Envelope.type', '=', sql.lit(EnvelopeType.DOCUMENT))
    .groupBy('month')
    .orderBy('month', 'desc');

  const result = await qb.execute();

  const transformedData = {
    labels: result
      .map((row) => DateTime.fromFormat(row.month, 'yyyy-MM-dd').toFormat('MMM yyyy'))
      .reverse(),
    datasets: [
      {
        label: type === 'count' ? 'Completed Documents per Month' : 'Total Completed Documents',
        data: result
          .map((row) => (type === 'count' ? Number(row.count) : Number(row.cume_count)))
          .reverse(),
      },
    ],
  };

  return addZeroMonth(transformedData, type === 'cumulative');
};

export type GetCompletedDocumentsMonthlyResult = Awaited<
  ReturnType<typeof getCompletedDocumentsMonthly>
>;
