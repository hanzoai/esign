import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { jobs } from '@hanzo/sign-lib/jobs/client';
import { buildOrganisationWhereQuery } from '@hanzo/sign-lib/utils/organisations';
import { prisma } from '@hanzo/sign-prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZLeaveOrganisationRequestSchema,
  ZLeaveOrganisationResponseSchema,
} from './leave-organisation.types';

export const leaveOrganisationRoute = authenticatedProcedure
  .input(ZLeaveOrganisationRequestSchema)
  .output(ZLeaveOrganisationResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId } = input;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({ organisationId, userId }),
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    await prisma.organisationMember.delete({
      where: {
        userId_organisationId: {
          userId,
          organisationId,
        },
      },
    });

    await jobs.triggerJob({
      name: 'send.organisation-member-left.email',
      payload: {
        organisationId: organisation.id,
        memberUserId: userId,
      },
    });
  });
