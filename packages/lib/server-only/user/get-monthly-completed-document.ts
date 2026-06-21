import { DocumentStatus, EnvelopeType } from '@prisma/client';
import { DateTime } from 'luxon';

import { kyselyPrisma, monthTrunc, sql } from '@hanzo/sign-prisma';

export const getCompletedDocumentsMonthly = async () => {
  // SQLite: truncate to month via strftime; enum columns are TEXT so values
  // compare directly with no `::"Enum"` cast.
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
    .orderBy('month', 'desc')
    .limit(12);

  const result = await qb.execute();

  return result.map((row) => ({
    month: DateTime.fromFormat(row.month, 'yyyy-MM-dd').toFormat('yyyy-MM'),
    count: Number(row.count),
    cume_count: Number(row.cume_count),
  }));
};

export type GetCompletedDocumentsMonthlyResult = Awaited<
  ReturnType<typeof getCompletedDocumentsMonthly>
>;
