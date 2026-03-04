import { getInternalClaimPlans } from '@hanzo/sign-ee/server-only/stripe/get-internal-claim-plans';
import { getSubscription } from '@hanzo/sign-ee/server-only/stripe/get-subscription';
import { IS_BILLING_ENABLED } from '@hanzo/sign-lib/constants/app';
import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';

import { authenticatedProcedure } from '../trpc';
import { ZGetSubscriptionRequestSchema } from './get-subscription.types';

export const getSubscriptionRoute = authenticatedProcedure
  .input(ZGetSubscriptionRequestSchema)
  .query(async ({ ctx, input }) => {
    const { organisationId } = input;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const userId = ctx.user.id;

    if (!IS_BILLING_ENABLED()) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Billing is not enabled',
      });
    }

    const [subscription, plans] = await Promise.all([
      getSubscription({
        organisationId,
        userId,
      }),
      getInternalClaimPlans(),
    ]);

    return {
      subscription,
      plans,
    };
  });
