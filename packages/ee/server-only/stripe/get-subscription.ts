import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@hanzo/sign-lib/constants/organisations';
import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { stripe } from '@hanzo/sign-lib/server-only/stripe';
import { buildOrganisationWhereQuery } from '@hanzo/sign-lib/utils/organisations';
import { prisma } from '@hanzo/sign-prisma';

export type GetSubscriptionOptions = {
  userId: number;
  organisationId: string;
};

export const getSubscription = async ({ organisationId, userId }: GetSubscriptionOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
    include: {
      subscription: true,
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  if (!organisation.subscription) {
    return null;
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(organisation.subscription.planId, {
    expand: ['items.data.price.product'],
  });

  return {
    organisationSubscription: organisation.subscription,
    stripeSubscription,
  };
};
