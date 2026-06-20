import { Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import type { FindResultResponse } from '@hanzo/sign-lib/types/search-params';
import {
  buildOrganisationWhereQuery,
  getHighestOrganisationRoleInGroup,
} from '@hanzo/sign-lib/utils/organisations';
import { prisma } from '@hanzo/sign-prisma';

import {
  ZFindOrganisationMembersRequestSchema,
  ZFindOrganisationMembersResponseSchema,
} from './find-organisation-members.types';

type FindOrganisationMembersOptions = {
  userId: number;
  organisationId: string;
  query?: string;
  page?: number;
  perPage?: number;
};

export const findOrganisationMembers = async ({
  userId,
  organisationId,
  query,
  page = 1,
  perPage = 10,
}: FindOrganisationMembersOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({ organisationId, userId }),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const whereClause: Prisma.OrganisationMemberWhereInput = {
    organisationId: organisation.id,
  };

  if (query) {
    whereClause.user = {
      OR: [
        {
          email: {
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
    prisma.organisationMember.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        organisationId: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarImageId: true,
          },
        },
        organisationGroupMembers: {
          select: {
            group: true,
          },
        },
        createdAt: true,
      },
    }),
    prisma.organisationMember.count({
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
