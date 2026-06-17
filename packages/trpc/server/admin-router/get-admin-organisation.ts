import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { prisma } from '@hanzo/sign-prisma';

type GetOrganisationOptions = {
  organisationId: string;
};

export const getAdminOrganisation = async ({ organisationId }: GetOrganisationOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: {
      id: organisationId,
    },
    include: {
      organisationClaim: true,
      organisationGlobalSettings: true,
      teams: true,
      members: {
        include: {
          organisationGroupMembers: {
            include: {
              group: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
      subscription: true,
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  return organisation;
};
