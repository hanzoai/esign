import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@hanzo/esign-lib/constants/organisations';
import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@hanzo/esign-lib/utils/organisations';
import { prisma } from '@hanzo/esign-prisma';

import {
  ZGetOrganisationEmailDomainRequestSchema,
  ZGetOrganisationEmailDomainResponseSchema,
} from './get-organisation-email-domain.types';

type GetOrganisationEmailDomainOptions = {
  userId: number;
  emailDomainId: string;
};

export const getOrganisationEmailDomain = async ({
  userId,
  emailDomainId,
}: GetOrganisationEmailDomainOptions) => {
  const emailDomain = await prisma.emailDomain.findFirst({
    where: {
      id: emailDomainId,
      organisation: buildOrganisationWhereQuery({
        organisationId: undefined,
        userId,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    },
    omit: {
      privateKey: true,
    },
    include: {
      emails: true,
    },
  });

  if (!emailDomain) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Email domain not found',
    });
  }

  return emailDomain;
};
