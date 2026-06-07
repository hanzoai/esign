import { OrganisationType } from '@prisma/client';

import { createOrganisation } from '@hanzo/sign-lib/server-only/organisation/create-organisation';
import { INTERNAL_CLAIM_ID, internalClaims } from '@hanzo/sign-lib/types/subscription';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateOrganisationRequestSchema,
  ZCreateOrganisationResponseSchema,
} from './create-organisation.types';

export const createOrganisationRoute = authenticatedProcedure
  .input(ZCreateOrganisationRequestSchema)
  .output(ZCreateOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { name } = input;
    const { user } = ctx;

    await createOrganisation({
      userId: user.id,
      name,
      type: OrganisationType.ORGANISATION,
      claim: internalClaims[INTERNAL_CLAIM_ID.FREE],
    });

    return {
      paymentRequired: false,
    };
  });
