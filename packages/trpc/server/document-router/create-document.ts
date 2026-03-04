import { EnvelopeType } from '@prisma/client';

import { getServerLimits } from '@hanzo/sign-ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { createEnvelope } from '@hanzo/sign-lib/server-only/envelope/create-envelope';
import { insertFormValuesInPdf } from '@hanzo/sign-lib/server-only/pdf/insert-form-values-in-pdf';
import { putNormalizedPdfFileServerSide } from '@hanzo/sign-lib/universal/upload/put-file.server';
import { mapSecondaryIdToDocumentId } from '@hanzo/sign-lib/utils/envelope';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateDocumentRequestSchema,
  ZCreateDocumentResponseSchema,
  createDocumentMeta,
} from './create-document.types';

export const createDocumentRoute = authenticatedProcedure
  .meta(createDocumentMeta)
  .input(ZCreateDocumentRequestSchema)
  .output(ZCreateDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;

    const { payload, file } = input;

    const {
      title,
      externalId,
      visibility,
      globalAccessAuth,
      globalActionAuth,
      recipients,
      meta,
      folderId,
      formValues,
      attachments,
    } = payload;

    let pdf = Buffer.from(await file.arrayBuffer());

    if (formValues) {
      // eslint-disable-next-line require-atomic-updates
      pdf = (await insertFormValuesInPdf({
        pdf,
        formValues,
      })) as Buffer<ArrayBuffer>;
    }

    const { id: documentDataId } = await putNormalizedPdfFileServerSide({
      name: file.name,
      type: 'application/pdf',
      arrayBuffer: async () => Promise.resolve(pdf as unknown as ArrayBuffer),
    });

    ctx.logger.info({
      input: {
        folderId,
      },
    });

    const { remaining } = await getServerLimits({ userId: user.id, teamId });

    if (remaining.documents <= 0) {
      throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
        message: 'You have reached your document limit for this month. Please upgrade your plan.',
        statusCode: 400,
      });
    }

    const document = await createEnvelope({
      userId: user.id,
      teamId,
      internalVersion: 1,
      data: {
        type: EnvelopeType.DOCUMENT,
        title,
        externalId,
        visibility,
        globalAccessAuth,
        globalActionAuth,
        formValues,
        recipients: (recipients || []).map((recipient) => ({
          ...recipient,
          fields: (recipient.fields || []).map((field) => ({
            ...field,
            page: field.pageNumber,
            positionX: field.pageX,
            positionY: field.pageY,
            documentDataId,
          })),
        })),
        folderId,
        envelopeItems: [
          {
            // If you ever allow more than 1 in this endpoint, make sure to use `maximumEnvelopeItemCount` to limit it.
            documentDataId,
          },
        ],
      },
      attachments,
      meta: {
        ...meta,
        emailSettings: meta?.emailSettings ?? undefined,
      },
      requestMetadata: ctx.metadata,
    });

    return {
      envelopeId: document.id,
      id: mapSecondaryIdToDocumentId(document.secondaryId),
    };
  });
