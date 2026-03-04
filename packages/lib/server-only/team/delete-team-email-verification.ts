import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@hanzo/sign-lib/constants/teams';
import { prisma } from '@hanzo/sign-prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type DeleteTeamEmailVerificationOptions = {
  userId: number;
  teamId: number;
};

export const deleteTeamEmailVerification = async ({
  userId,
  teamId,
}: DeleteTeamEmailVerificationOptions) => {
  await prisma.team.findFirstOrThrow({
    where: buildTeamWhereQuery({
      teamId,
      userId,
      roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
    }),
  });

  await prisma.teamEmailVerification.delete({
    where: {
      teamId,
    },
  });
};
