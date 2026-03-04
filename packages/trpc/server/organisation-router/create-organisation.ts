import { OrganisationType } from '@prisma/client';

import { createCheckoutSession } from '@hanzo/sign-ee/server-only/stripe/create-checkout-session';
import { createCustomer } from '@hanzo/sign-ee/server-only/stripe/create-customer';
import { IS_BILLING_ENABLED, NEXT_PUBLIC_WEBAPP_URL } from '@hanzo/sign-lib/constants/app';
import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { createOrganisation } from '@hanzo/sign-lib/server-only/organisation/create-organisation';
import { INTERNAL_CLAIM_ID, internalClaims } from '@hanzo/sign-lib/types/subscription';
import { generateStripeOrganisationCreateMetadata } from '@hanzo/sign-lib/utils/billing';
import { prisma } from '@hanzo/sign-prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateOrganisationRequestSchema,
  ZCreateOrganisationResponseSchema,
} from './create-organisation.types';

export const createOrganisationRoute = authenticatedProcedure
  // .meta(createOrganisationMeta)
  .input(ZCreateOrganisationRequestSchema)
  .output(ZCreateOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { name, priceId } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        priceId,
      },
    });

    // Check if user can create a free organiastion.
    if (IS_BILLING_ENABLED() && !priceId) {
      const userOrganisations = await prisma.organisation.findMany({
        where: {
          ownerUserId: user.id,
          subscription: {
            is: null,
          },
        },
      });

      if (userOrganisations.length >= 1) {
        throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
          message: 'You have reached the maximum number of free organisations.',
        });
      }
    }

    // Create checkout session for payment.
    if (IS_BILLING_ENABLED() && priceId) {
      const customer = await createCustomer({
        email: user.email,
        name: user.name || user.email,
      });

      const checkoutUrl = await createCheckoutSession({
        priceId,
        customerId: customer.id,
        returnUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/settings/organisations`,
        subscriptionMetadata: generateStripeOrganisationCreateMetadata(name, user.id),
      });

      return {
        paymentRequired: true,
        checkoutUrl,
      };
    }

    // Free organisations should be Personal by default.
    const organisationType = IS_BILLING_ENABLED()
      ? OrganisationType.PERSONAL
      : OrganisationType.ORGANISATION;

    await createOrganisation({
      userId: user.id,
      name,
      type: organisationType,
      claim: internalClaims[INTERNAL_CLAIM_ID.FREE],
    });

    return {
      paymentRequired: false,
    };
  });
