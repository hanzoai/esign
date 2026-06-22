import type { Prisma } from '@prisma/client';
import type { z } from 'zod';

import type { FindResultResponse } from '@hanzo/esign-lib/types/search-params';
import { prisma } from '@hanzo/esign-prisma';
import type SubscriptionClaimSchema from '@hanzo/esign-prisma/generated/zod/modelSchema/SubscriptionClaimSchema';

import {
  ZFindSubscriptionClaimsRequestSchema,
  ZFindSubscriptionClaimsResponseSchema,
} from './find-subscription-claims.types';

type FindSubscriptionClaimsOptions = {
  query?: string;
  page?: number;
  perPage?: number;
};

export const findSubscriptionClaims = async ({
  query,
  page = 1,
  perPage = 50,
}: FindSubscriptionClaimsOptions) => {
  let whereClause: Prisma.SubscriptionClaimWhereInput = {};

  if (query) {
    whereClause = {
      OR: [
        {
          id: {
            contains: query,
          },
        },
        {
          name: {
            contains: query,
          },
        },
      ],
    };
  }

  const [data, count] = await Promise.all([
    prisma.subscriptionClaim.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        name: 'asc',
      },
    }),
    prisma.subscriptionClaim.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<z.infer<typeof SubscriptionClaimSchema>[]>;
};
