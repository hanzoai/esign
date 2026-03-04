import { EnvelopeType } from '@prisma/client';

import { jobs } from '@hanzo/sign-lib/jobs/client';
import { unsafeGetEntireEnvelope } from '@hanzo/sign-lib/server-only/admin/get-entire-document';
import { isDocumentCompleted } from '@hanzo/sign-lib/utils/document';
import { mapSecondaryIdToDocumentId } from '@hanzo/sign-lib/utils/envelope';

import { adminProcedure } from '../trpc';
import {
  ZResealDocumentRequestSchema,
  ZResealDocumentResponseSchema,
} from './reseal-document.types';

export const resealDocumentRoute = adminProcedure
  .input(ZResealDocumentRequestSchema)
  .output(ZResealDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    const envelope = await unsafeGetEntireEnvelope({
      id: {
        type: 'envelopeId',
        id,
      },
      type: EnvelopeType.DOCUMENT,
    });

    const isResealing = isDocumentCompleted(envelope.status);

    await jobs.triggerJob({
      name: 'internal.seal-document',
      payload: {
        documentId: mapSecondaryIdToDocumentId(envelope.secondaryId),
        isResealing,
      },
    });
  });
