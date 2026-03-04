import { syncMemberCountWithStripeSeatPlan } from '@hanzo/sign-ee/server-only/stripe/update-subscription-item-quantity';
import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { jobs } from '@hanzo/sign-lib/jobs/client';
import { validateIfSubscriptionIsRequired } from '@hanzo/sign-lib/utils/billing';
import { buildOrganisationWhereQuery } from '@hanzo/sign-lib/utils/organisations';
import { prisma } from '@hanzo/sign-prisma';
import { OrganisationMemberInviteStatus } from '@hanzo/sign-prisma/client';

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
      include: {
        organisationClaim: true,
        subscription: true,
        invites: {
          where: {
            status: OrganisationMemberInviteStatus.PENDING,
          },
          select: {
            id: true,
          },
        },
        members: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    const { organisationClaim } = organisation;

    const subscription = validateIfSubscriptionIsRequired(organisation.subscription);

    const inviteCount = organisation.invites.length;
    const newMemberCount = organisation.members.length + inviteCount - 1;

    if (subscription) {
      await syncMemberCountWithStripeSeatPlan(subscription, organisationClaim, newMemberCount);
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
