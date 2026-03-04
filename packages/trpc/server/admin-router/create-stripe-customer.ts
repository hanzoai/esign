import { createCustomer } from '@hanzo/sign-ee/server-only/stripe/create-customer';
import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { prisma } from '@hanzo/sign-prisma';

import { adminProcedure } from '../trpc';
import {
  ZCreateStripeCustomerRequestSchema,
  ZCreateStripeCustomerResponseSchema,
} from './create-stripe-customer.types';

export const createStripeCustomerRoute = adminProcedure
  .input(ZCreateStripeCustomerRequestSchema)
  .output(ZCreateStripeCustomerResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId } = input;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const organisation = await prisma.organisation.findUnique({
      where: {
        id: organisationId,
      },
      include: {
        owner: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    await prisma.$transaction(async (tx) => {
      const stripeCustomer = await createCustomer({
        name: organisation.name,
        email: organisation.owner.email,
      });

      await tx.organisation.update({
        where: {
          id: organisationId,
        },
        data: {
          customerId: stripeCustomer.id,
        },
      });
    });
  });
