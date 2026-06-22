import { Prisma } from '@prisma/client';

import type { FindResultResponse } from '@hanzo/esign-lib/types/search-params';
import { prisma } from '@hanzo/esign-prisma';

import {
  ZFindAdminOrganisationsRequestSchema,
  ZFindAdminOrganisationsResponseSchema,
} from './find-admin-organisations.types';

type FindAdminOrganisationsOptions = {
  query?: string;
  page?: number;
  perPage?: number;
  ownerUserId?: number;
  memberUserId?: number;
};

export const findAdminOrganisations = async ({
  query,
  page = 1,
  perPage = 10,
  ownerUserId,
  memberUserId,
}: FindAdminOrganisationsOptions) => {
  // SQLite `LIKE` (Prisma `contains`) is case-insensitive for ASCII, and org
  // ids/urls are case-stable cuids, so no `mode: 'insensitive'` is needed (it
  // is unsupported by the SQLite connector).
  let whereClause: Prisma.OrganisationWhereInput = {};

  if (query) {
    whereClause = {
      OR: [
        {
          id: {
            contains: query,
          },
        },
        {
          owner: {
            email: {
              contains: query,
            },
          },
        },
        {
          customerId: {
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

  if (query && query.startsWith('claim:')) {
    whereClause = {
      organisationClaim: {
        originalSubscriptionClaimId: {
          contains: query.slice(6),
        },
      },
    };
  }

  if (query && query.startsWith('org_')) {
    whereClause = {
      OR: [
        {
          id: {
            equals: query,
          },
        },
        {
          url: {
            equals: query,
          },
        },
      ],
    };
  }

  if (ownerUserId) {
    whereClause = {
      ...whereClause,
      ownerUserId,
    };
  }

  if (memberUserId) {
    whereClause = {
      ...whereClause,
      members: {
        some: { userId: memberUserId },
      },
    };
  }

  const [data, count] = await Promise.all([
    prisma.organisation.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        name: true,
        url: true,
        customerId: true,
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        subscription: true,
      },
    }),
    prisma.organisation.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
