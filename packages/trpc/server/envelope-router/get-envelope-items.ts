import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { getEnvelopeWhereInput } from '@hanzo/sign-lib/server-only/envelope/get-envelope-by-id';
import { prisma } from '@hanzo/sign-prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetEnvelopeItemsRequestSchema,
  ZGetEnvelopeItemsResponseSchema,
} from './get-envelope-items.types';

// Not intended for V2 API usage.
export const getEnvelopeItemsRoute = authenticatedProcedure
  .input(ZGetEnvelopeItemsRequestSchema)
  .output(ZGetEnvelopeItemsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { envelopeId } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: null,
      userId: user.id,
      teamId,
    });

    const envelope = await prisma.envelope.findUnique({
      where: envelopeWhereInput,
      include: {
        envelopeItems: {
          include: {
            documentData: true,
          },
        },
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope could not be found',
      });
    }

    return {
      data: envelope.envelopeItems,
    };
  });
