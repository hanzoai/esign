import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@hanzo/esign-lib/constants/organisations';
import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@hanzo/esign-lib/utils/organisations';
import { prisma } from '@hanzo/esign-prisma';

import {
  ZGetOrganisationAuthenticationPortalRequestSchema,
  ZGetOrganisationAuthenticationPortalResponseSchema,
} from './get-organisation-authentication-portal.types';

type GetOrganisationAuthenticationPortalOptions = {
  userId: number;
  organisationId: string;
};

export const getOrganisationAuthenticationPortal = async ({
  userId,
  organisationId,
}: GetOrganisationAuthenticationPortalOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
    include: {
      organisationAuthenticationPortal: {
        select: {
          defaultOrganisationRole: true,
          enabled: true,
          clientId: true,
          wellKnownUrl: true,
          autoProvisionUsers: true,
          allowedDomains: true,
          clientSecret: true,
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  const portal = organisation.organisationAuthenticationPortal;

  return {
    defaultOrganisationRole: portal.defaultOrganisationRole,
    enabled: portal.enabled,
    clientId: portal.clientId,
    wellKnownUrl: portal.wellKnownUrl,
    autoProvisionUsers: portal.autoProvisionUsers,
    allowedDomains: portal.allowedDomains,
    clientSecretProvided: Boolean(portal.clientSecret),
  };
};
