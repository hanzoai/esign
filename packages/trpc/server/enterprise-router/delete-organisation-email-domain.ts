import { deleteEmailDomain } from '@hanzo/sign-ee/server-only/lib/delete-email-domain';
import { IS_BILLING_ENABLED } from '@hanzo/sign-lib/constants/app';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@hanzo/sign-lib/constants/organisations';
import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@hanzo/sign-lib/utils/organisations';
import { prisma } from '@hanzo/sign-prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteOrganisationEmailDomainRequestSchema,
  ZDeleteOrganisationEmailDomainResponseSchema,
} from './delete-organisation-email-domain.types';

export const deleteOrganisationEmailDomainRoute = authenticatedProcedure
  .input(ZDeleteOrganisationEmailDomainRequestSchema)
  .output(ZDeleteOrganisationEmailDomainResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { emailDomainId } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        emailDomainId,
      },
    });

    if (!IS_BILLING_ENABLED()) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Billing is not enabled',
      });
    }

    const emailDomain = await prisma.emailDomain.findFirst({
      where: {
        id: emailDomainId,
        organisation: buildOrganisationWhereQuery({
          organisationId: undefined,
          userId: user.id,
          roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
        }),
      },
    });

    if (!emailDomain) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Email domain not found',
      });
    }

    await deleteEmailDomain({
      emailDomainId: emailDomain.id,
    });
  });
