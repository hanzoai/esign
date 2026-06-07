import { reregisterEmailDomain } from '@hanzo/sign-lib/server-only/email-domain/reregister-email-domain';

import { adminProcedure } from '../trpc';
import {
  ZReregisterEmailDomainRequestSchema,
  ZReregisterEmailDomainResponseSchema,
} from './reregister-email-domain.types';

export const reregisterEmailDomainRoute = adminProcedure
  .input(ZReregisterEmailDomainRequestSchema)
  .output(ZReregisterEmailDomainResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { emailDomainId } = input;

    ctx.logger.info({
      input: {
        emailDomainId,
      },
    });

    await reregisterEmailDomain({ emailDomainId });
  });
