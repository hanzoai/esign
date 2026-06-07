import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@hanzo/sign-lib/constants/organisations';
import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { jobs } from '@hanzo/sign-lib/jobs/client';
import { buildOrganisationWhereQuery } from '@hanzo/sign-lib/utils/organisations';
import { prisma } from '@hanzo/sign-prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteOrganisationMembersRequestSchema,
  ZDeleteOrganisationMembersResponseSchema,
} from './delete-organisation-members.types';

export const deleteOrganisationMembersRoute = authenticatedProcedure
  //   .meta(deleteOrganisationMembersMeta)
  .input(ZDeleteOrganisationMembersRequestSchema)
  .output(ZDeleteOrganisationMembersResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId, organisationMemberIds } = input;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        organisationId,
        organisationMemberIds,
      },
    });

    await deleteOrganisationMembers({
      userId,
      organisationId,
      organisationMemberIds,
    });
  });

type DeleteOrganisationMembersProps = {
  userId: number;
  organisationId: string;
  organisationMemberIds: string[];
};

export const deleteOrganisationMembers = async ({
  userId,
  organisationId,
  organisationMemberIds,
}: DeleteOrganisationMembersProps) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
    include: {
      members: {
        select: {
          id: true,
          userId: true,
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED);
  }

  const membersToDelete = organisation.members.filter((member) =>
    organisationMemberIds.includes(member.id),
  );

  await prisma.$transaction(async (tx) => {
    await tx.organisationMember.deleteMany({
      where: {
        id: {
          in: organisationMemberIds,
        },
        organisationId,
      },
    });
  });

  for (const member of membersToDelete) {
    await jobs.triggerJob({
      name: 'send.organisation-member-left.email',
      payload: {
        organisationId,
        memberUserId: member.userId,
      },
    });
  }
};
