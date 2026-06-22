import { getHighestOrganisationRoleInGroup } from '@hanzo/esign-lib/utils/organisations';
import { prisma } from '@hanzo/esign-prisma';

import {
  ZGetOrganisationsRequestSchema,
  ZGetOrganisationsResponseSchema,
} from './get-organisations.types';

export const getOrganisations = async ({ userId }: { userId: number }) => {
  const organisations = await prisma.organisation.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      members: {
        where: {
          userId,
        },
      },
      groups: {
        where: {
          organisationGroupMembers: {
            some: {
              organisationMember: {
                userId,
              },
            },
          },
        },
      },
    },
  });

  return organisations.map(({ groups, ...organisation }) => {
    const currentOrganisationRole = getHighestOrganisationRoleInGroup(groups);

    return {
      ...organisation,
      currentOrganisationRole: currentOrganisationRole,
      currentMemberId: organisation.members[0].id,
    };
  });
};
