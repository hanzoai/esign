// esign ZAP handlers — document router (incl. attachment subtree, 26/26 procedures).
//
// Verbatim tRPC procedure bodies rewired to (ctx, raw). Input is validated by
// the SAME Zod schema the tRPC procedure used; server-only functions and the
// per-file exported helper (findInbox) are reused unchanged. The `.meta()` API
// metadata is dropped. Unauthenticated tRPC procedures (share, accessAuth.
// request2FAEmail) still run after the auth mint, so they have a ctx; their
// bodies are ported as-is (share reads ctx.user?.id, request2FAEmail reads
// ctx.user / ctx.metadata). Route keys mirror the tRPC nested router shape
// (see document-router.zap).
import type { DocumentData } from '@prisma/client';
import { DocumentDataType, DocumentStatus, EnvelopeType, RecipientRole } from '@prisma/client';
import { DateTime } from 'luxon';

import { PDF_SIZE_A4_72PPI } from '@hanzo/esign-lib/constants/pdf';
import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { TWO_FACTOR_EMAIL_EXPIRATION_MINUTES } from '@hanzo/esign-lib/server-only/2fa/email/constants';
import { send2FATokenEmail } from '@hanzo/esign-lib/server-only/2fa/email/send-2fa-token-email';
import { createDocumentData } from '@hanzo/esign-lib/server-only/document-data/create-document-data';
import { updateDocumentMeta } from '@hanzo/esign-lib/server-only/document-meta/upsert-document-meta';
import { deleteDocument } from '@hanzo/esign-lib/server-only/document/delete-document';
import { findDocumentAuditLogs } from '@hanzo/esign-lib/server-only/document/find-document-audit-logs';
import { findDocuments } from '@hanzo/esign-lib/server-only/document/find-documents';
import { getDocumentWithDetailsById } from '@hanzo/esign-lib/server-only/document/get-document-with-details-by-id';
import { getStats } from '@hanzo/esign-lib/server-only/document/get-stats';
import { resendDocument } from '@hanzo/esign-lib/server-only/document/resend-document';
import { searchDocumentsWithKeyword } from '@hanzo/esign-lib/server-only/document/search-documents-with-keyword';
import { sendDocument } from '@hanzo/esign-lib/server-only/document/send-document';
import { createAttachment } from '@hanzo/esign-lib/server-only/envelope-attachment/create-attachment';
import { deleteAttachment } from '@hanzo/esign-lib/server-only/envelope-attachment/delete-attachment';
import { findAttachmentsByEnvelopeId } from '@hanzo/esign-lib/server-only/envelope-attachment/find-attachments-by-envelope-id';
import { updateAttachment } from '@hanzo/esign-lib/server-only/envelope-attachment/update-attachment';
import { createEnvelope } from '@hanzo/esign-lib/server-only/envelope/create-envelope';
import { duplicateEnvelope } from '@hanzo/esign-lib/server-only/envelope/duplicate-envelope';
import {
  getEnvelopeById,
  getEnvelopeWhereInput,
} from '@hanzo/esign-lib/server-only/envelope/get-envelope-by-id';
import { getMultipleEnvelopeWhereInput } from '@hanzo/esign-lib/server-only/envelope/get-envelopes-by-ids';
import { updateEnvelope } from '@hanzo/esign-lib/server-only/envelope/update-envelope';
import { getServerLimits } from '@hanzo/esign-lib/server-only/limits/server';
import { generateAuditLogPdf } from '@hanzo/esign-lib/server-only/pdf/generate-audit-log-pdf';
import { generateCertificatePdf } from '@hanzo/esign-lib/server-only/pdf/generate-certificate-pdf';
import { insertFormValuesInPdf } from '@hanzo/esign-lib/server-only/pdf/insert-form-values-in-pdf';
import { assertRateLimit } from '@hanzo/esign-lib/server-only/rate-limit/rate-limit-middleware';
import { request2FAEmailRateLimit } from '@hanzo/esign-lib/server-only/rate-limit/rate-limits';
import { createOrGetShareLink } from '@hanzo/esign-lib/server-only/share/create-or-get-share-link';
import { DocumentAuth } from '@hanzo/esign-lib/types/document-auth';
import { putNormalizedPdfFileServerSide } from '@hanzo/esign-lib/universal/upload/put-file.server';
import {
  getPresignGetUrl,
  getPresignPostUrl,
} from '@hanzo/esign-lib/universal/upload/server-actions';
import {
  mapEnvelopeToDocumentLite,
  mapEnvelopesToDocumentMany,
} from '@hanzo/esign-lib/utils/document';
import { isDocumentCompleted } from '@hanzo/esign-lib/utils/document';
import { extractDocumentAuthMethods } from '@hanzo/esign-lib/utils/document-auth';
import { mapSecondaryIdToDocumentId } from '@hanzo/esign-lib/utils/envelope';
import { prisma } from '@hanzo/esign-prisma';

import { ZAccessAuthRequest2FAEmailRequestSchema } from '../../../server/document-router/access-auth-request-2fa-email.types';
import { ZCreateAttachmentRequestSchema } from '../../../server/document-router/attachment/create-attachment.types';
import { ZDeleteAttachmentRequestSchema } from '../../../server/document-router/attachment/delete-attachment.types';
import { ZFindAttachmentsRequestSchema } from '../../../server/document-router/attachment/find-attachments.types';
import { ZUpdateAttachmentRequestSchema } from '../../../server/document-router/attachment/update-attachment.types';
import { ZCreateDocumentTemporaryRequestSchema } from '../../../server/document-router/create-document-temporary.types';
import { ZCreateDocumentRequestSchema } from '../../../server/document-router/create-document.types';
import { ZDeleteDocumentRequestSchema } from '../../../server/document-router/delete-document.types';
import { ZDistributeDocumentRequestSchema } from '../../../server/document-router/distribute-document.types';
import { ZDownloadDocumentAuditLogsRequestSchema } from '../../../server/document-router/download-document-audit-logs.types';
import { ZDownloadDocumentRequestSchema as ZDownloadDocumentBetaRequestSchema } from '../../../server/document-router/download-document-beta.types';
import { ZDownloadDocumentCertificateRequestSchema } from '../../../server/document-router/download-document-certificate.types';
import { ZDownloadDocumentRequestSchema } from '../../../server/document-router/download-document.types';
import { ZDuplicateDocumentRequestSchema } from '../../../server/document-router/duplicate-document.types';
import { ZFindDocumentAuditLogsRequestSchema } from '../../../server/document-router/find-document-audit-logs.types';
import { ZFindDocumentsInternalRequestSchema } from '../../../server/document-router/find-documents-internal.types';
import { ZFindDocumentsRequestSchema } from '../../../server/document-router/find-documents.types';
import { findInbox } from '../../../server/document-router/find-inbox';
import { ZFindInboxRequestSchema } from '../../../server/document-router/find-inbox.types';
import { ZGetDocumentByTokenRequestSchema } from '../../../server/document-router/get-document-by-token.types';
import { ZGetDocumentRequestSchema } from '../../../server/document-router/get-document.types';
import { ZGetDocumentsByIdsRequestSchema } from '../../../server/document-router/get-documents-by-ids.types';
import { ZGetInboxCountRequestSchema } from '../../../server/document-router/get-inbox-count.types';
import { ZRedistributeDocumentRequestSchema } from '../../../server/document-router/redistribute-document.types';
import { ZSearchDocumentRequestSchema } from '../../../server/document-router/search-document.types';
import { ZShareDocumentRequestSchema } from '../../../server/document-router/share-document.types';
import { ZUpdateDocumentRequestSchema } from '../../../server/document-router/update-document.types';
import { ZGenericSuccessResponse } from '../../../server/schema';
import type { ZapContext } from '../context';
import type { ZapRouteMap } from '../dispatch';

export const documentRoutes: ZapRouteMap = {
  'document.get': async (ctx: ZapContext, raw) => {
    const { documentId } = ZGetDocumentRequestSchema.parse(raw);
    const { teamId, user } = ctx;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    return await getDocumentWithDetailsById({
      userId: user.id,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
    });
  },

  'document.getMany': async (ctx: ZapContext, raw) => {
    const { documentIds } = ZGetDocumentsByIdsRequestSchema.parse(raw);
    const { teamId, user } = ctx;

    ctx.logger.info({
      input: {
        documentIds,
      },
    });

    const { envelopeWhereInput } = await getMultipleEnvelopeWhereInput({
      ids: {
        type: 'documentId',
        ids: documentIds,
      },
      userId: user.id,
      teamId,
      type: EnvelopeType.DOCUMENT,
    });

    const envelopes = await prisma.envelope.findMany({
      where: envelopeWhereInput,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recipients: {
          orderBy: {
            id: 'asc',
          },
        },
        team: {
          select: {
            id: true,
            url: true,
          },
        },
      },
    });

    return {
      data: envelopes.map((envelope) => mapEnvelopesToDocumentMany(envelope)),
    };
  },

  'document.find': async (ctx: ZapContext, raw) => {
    const {
      query,
      templateId,
      page,
      perPage,
      orderByDirection,
      orderByColumn,
      source,
      status,
      folderId,
    } = ZFindDocumentsRequestSchema.parse(raw);
    const { user, teamId } = ctx;

    const documents = await findDocuments({
      userId: user.id,
      teamId,
      templateId,
      query,
      source,
      status,
      page,
      perPage,
      folderId,
      orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
      useWindowedCount: false,
    });

    return {
      ...documents,
      data: documents.data.map((envelope) => mapEnvelopesToDocumentMany(envelope)),
    };
  },

  'document.create': async (ctx: ZapContext, raw) => {
    const { payload, file } = ZCreateDocumentRequestSchema.parse(raw);
    const { user, teamId } = ctx;

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
  },

  'document.update': async (ctx: ZapContext, raw) => {
    const { documentId, data, meta = {} } = ZUpdateDocumentRequestSchema.parse(raw);
    const { teamId } = ctx;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const userId = ctx.user.id;

    const envelope = await updateEnvelope({
      userId,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
      data,
      meta,
      requestMetadata: ctx.metadata,
    });

    const mappedDocument = {
      ...envelope,
      id: mapSecondaryIdToDocumentId(envelope.secondaryId),
      envelopeId: envelope.id,
    };

    return mappedDocument;
  },

  'document.delete': async (ctx: ZapContext, raw) => {
    const { documentId } = ZDeleteDocumentRequestSchema.parse(raw);
    const { teamId } = ctx;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const userId = ctx.user.id;

    await deleteDocument({
      id: {
        type: 'documentId',
        id: documentId,
      },
      userId,
      teamId,
      requestMetadata: ctx.metadata,
    });

    return ZGenericSuccessResponse;
  },

  'document.duplicate': async (ctx: ZapContext, raw) => {
    const { documentId } = ZDuplicateDocumentRequestSchema.parse(raw);
    const { teamId, user } = ctx;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const duplicatedEnvelope = await duplicateEnvelope({
      id: {
        type: 'documentId',
        id: documentId,
      },
      userId: user.id,
      teamId,
    });

    return {
      id: duplicatedEnvelope.id,
      documentId: duplicatedEnvelope.legacyId.id,
    };
  },

  'document.downloadCertificate': async (ctx: ZapContext, raw) => {
    const { documentId } = ZDownloadDocumentCertificateRequestSchema.parse(raw);
    const { teamId } = ctx;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'documentId',
        id: documentId,
      },
      type: EnvelopeType.DOCUMENT,
      userId: ctx.user.id,
      teamId,
    });

    const envelope = await prisma.envelope.findFirst({
      where: envelopeWhereInput,
      include: {
        recipients: true,
        fields: {
          include: {
            signature: true,
          },
        },
        documentMeta: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    if (!isDocumentCompleted(envelope.status)) {
      throw new AppError('DOCUMENT_NOT_COMPLETE');
    }

    const certificatePdf = await generateCertificatePdf({
      envelope,
      recipients: envelope.recipients,
      fields: envelope.fields,
      language: envelope.documentMeta.language,
      envelopeOwner: {
        email: envelope.user.email,
        name: envelope.user.name || '',
      },
      pageWidth: PDF_SIZE_A4_72PPI.width,
      pageHeight: PDF_SIZE_A4_72PPI.height,
    });

    const result = await certificatePdf.save();

    const base64 = Buffer.from(result).toString('base64');

    return {
      data: base64,
      envelopeTitle: envelope.title,
    };
  },

  'document.distribute': async (ctx: ZapContext, raw) => {
    const { documentId, meta = {} } = ZDistributeDocumentRequestSchema.parse(raw);
    const { teamId } = ctx;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    if (Object.values(meta).length > 0) {
      await updateDocumentMeta({
        userId: ctx.user.id,
        teamId,
        id: {
          type: 'documentId',
          id: documentId,
        },
        subject: meta.subject,
        message: meta.message,
        dateFormat: meta.dateFormat,
        timezone: meta.timezone,
        redirectUrl: meta.redirectUrl,
        distributionMethod: meta.distributionMethod,
        emailSettings: meta.emailSettings ?? undefined,
        language: meta.language,
        emailId: meta.emailId,
        emailReplyTo: meta.emailReplyTo,
        requestMetadata: ctx.metadata,
      });
    }

    const envelope = await sendDocument({
      userId: ctx.user.id,
      id: {
        type: 'documentId',
        id: documentId,
      },
      teamId,
      requestMetadata: ctx.metadata,
    });

    return mapEnvelopeToDocumentLite(envelope);
  },

  'document.redistribute': async (ctx: ZapContext, raw) => {
    const { documentId, recipients } = ZRedistributeDocumentRequestSchema.parse(raw);
    const { teamId } = ctx;

    ctx.logger.info({
      input: {
        documentId,
        recipients,
      },
    });

    await resendDocument({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
      recipients,
      requestMetadata: ctx.metadata,
    });

    return ZGenericSuccessResponse;
  },

  'document.search': async (ctx: ZapContext, raw) => {
    const { query } = ZSearchDocumentRequestSchema.parse(raw);

    const documents = await searchDocumentsWithKeyword({
      query,
      userId: ctx.user.id,
    });

    return documents;
  },

  'document.share': async (ctx: ZapContext, raw) => {
    const { documentId, token } = ZShareDocumentRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    if (token) {
      return await createOrGetShareLink({ documentId, token });
    }

    if (!ctx.user?.id) {
      throw new Error('You must either provide a token or be logged in to create a sharing link.');
    }

    return await createOrGetShareLink({ documentId, userId: ctx.user.id });
  },

  'document.download': async (ctx: ZapContext, raw) => {
    const { documentId, version } = ZDownloadDocumentRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        documentId,
        version,
      },
    });

    // This endpoint is purely for V2 API, which is implemented in the Hono remix server.
    throw new Error('NOT_IMPLEMENTED');
  },

  'document.downloadBeta': async (ctx: ZapContext, raw) => {
    const { documentId, version } = ZDownloadDocumentBetaRequestSchema.parse(raw);
    const { teamId, user } = ctx;

    ctx.logger.info({
      input: {
        documentId,
        version,
      },
    });

    const envelope = await getEnvelopeById({
      id: {
        type: 'documentId',
        id: documentId,
      },
      type: EnvelopeType.DOCUMENT,
      userId: user.id,
      teamId,
    });

    // This error is done AFTER the get envelope so we can test access controls without S3.
    if (process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT !== 's3') {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Document downloads are only available when S3 storage is configured.',
      });
    }

    const documentData: DocumentData | undefined = envelope.envelopeItems[0]?.documentData;

    if (envelope.envelopeItems.length !== 1 || !documentData) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'This endpoint only supports documents with a single item. Use envelopes API instead.',
      });
    }

    if (documentData.type !== DocumentDataType.S3_PATH) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Document is not stored in S3 and cannot be downloaded via URL.',
      });
    }

    if (version === 'signed' && !isDocumentCompleted(envelope.status)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Document is not completed yet.',
      });
    }

    try {
      const data =
        version === 'original' ? documentData.initialData || documentData.data : documentData.data;

      const { url } = await getPresignGetUrl(data);

      const baseTitle = envelope.title.replace(/\.pdf$/, '');
      const suffix = version === 'signed' ? '_signed.pdf' : '.pdf';
      const filename = `${baseTitle}${suffix}`;

      return {
        downloadUrl: url,
        filename,
        contentType: 'application/pdf',
      };
    } catch (error) {
      ctx.logger.error({
        error,
        message: 'Failed to generate download URL',
        documentId,
        version,
      });

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to generate download URL',
      });
    }
  },

  'document.createDocumentTemporary': async (ctx: ZapContext, raw) => {
    const {
      title,
      externalId,
      visibility,
      globalAccessAuth,
      globalActionAuth,
      recipients,
      meta,
      folderId,
      attachments,
      formValues,
    } = ZCreateDocumentTemporaryRequestSchema.parse(raw);
    const { teamId, user } = ctx;

    const { remaining } = await getServerLimits({ userId: user.id, teamId });

    if (remaining.documents <= 0) {
      throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
        message: 'You have reached your document limit for this month. Please upgrade your plan.',
        statusCode: 400,
      });
    }

    const fileName = title.endsWith('.pdf') ? title : `${title}.pdf`;

    const { url, key } = await getPresignPostUrl(fileName, 'application/pdf');

    const documentData = await createDocumentData({
      data: key,
      type: DocumentDataType.S3_PATH,
    });

    const createdEnvelope = await createEnvelope({
      userId: ctx.user.id,
      teamId,
      normalizePdf: false, // Not normalizing because of presigned URL.
      internalVersion: 1,
      data: {
        type: EnvelopeType.DOCUMENT,
        title,
        externalId,
        visibility,
        formValues,
        globalAccessAuth,
        globalActionAuth,
        recipients: (recipients || []).map((recipient) => ({
          ...recipient,
          fields: (recipient.fields || []).map((field) => ({
            ...field,
            page: field.pageNumber,
            positionX: field.pageX,
            positionY: field.pageY,
            documentDataId: documentData.id,
          })),
        })),
        folderId,
        envelopeItems: [
          {
            // If you ever allow more than 1 in this endpoint, make sure to use `maximumEnvelopeItemCount` to limit it.
            documentDataId: documentData.id,
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

    const envelopeItems = await prisma.envelopeItem.findMany({
      where: {
        envelopeId: createdEnvelope.id,
      },
      include: {
        documentData: true,
      },
    });

    const legacyDocumentId = mapSecondaryIdToDocumentId(createdEnvelope.secondaryId);

    const firstDocumentData = envelopeItems[0].documentData;

    if (!firstDocumentData) {
      throw new Error('Document data not found');
    }

    return {
      document: {
        ...createdEnvelope,
        envelopeId: createdEnvelope.id,
        documentDataId: firstDocumentData.id,
        documentData: {
          ...firstDocumentData,
          envelopeItemId: envelopeItems[0].id,
        },
        documentMeta: {
          ...createdEnvelope.documentMeta,
          documentId: legacyDocumentId,
        },
        id: legacyDocumentId,
        fields: createdEnvelope.fields.map((field) => ({
          ...field,
          documentId: legacyDocumentId,
          templateId: null,
        })),
        recipients: createdEnvelope.recipients.map((recipient) => ({
          ...recipient,
          documentId: legacyDocumentId,
          templateId: null,
        })),
      },
      folder: createdEnvelope.folder, // Todo: Remove this prior to api-v2 release.
      uploadUrl: url,
    };
  },

  'document.getDocumentByToken': async (ctx: ZapContext, raw) => {
    const { token } = ZGetDocumentByTokenRequestSchema.parse(raw);

    const envelope = await prisma.envelope.findFirst({
      where: {
        type: EnvelopeType.DOCUMENT,
        recipients: {
          some: {
            token,
            email: ctx.user.email,
          },
        },
      },
      include: {
        envelopeItems: {
          include: {
            documentData: true,
          },
        },
      },
    });

    const firstDocumentData = envelope?.envelopeItems[0].documentData;

    if (!envelope || !firstDocumentData) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Document not found',
      });
    }

    if (envelope.envelopeItems.length !== 1) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'This endpoint does not support multiple items',
      });
    }

    ctx.logger.info({
      documentId: envelope.id,
    });

    return {
      documentData: firstDocumentData,
    };
  },

  'document.findDocumentsInternal': async (ctx: ZapContext, raw) => {
    const {
      query,
      templateId,
      page,
      perPage,
      orderByDirection,
      orderByColumn,
      source,
      status,
      period,
      senderIds,
      folderId,
    } = ZFindDocumentsInternalRequestSchema.parse(raw);
    const { user, teamId } = ctx;

    const [stats, documents] = await Promise.all([
      getStats({
        userId: user.id,
        teamId,
        period,
        search: query,
        folderId,
        senderIds,
      }),
      findDocuments({
        userId: user.id,
        teamId,
        query,
        templateId,
        page,
        perPage,
        source,
        status,
        period,
        senderIds,
        folderId,
        orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
      }),
    ]);

    return {
      ...documents,
      data: documents.data.map((envelope) => mapEnvelopesToDocumentMany(envelope)),
      stats,
    };
  },

  'document.accessAuth.request2FAEmail': async (ctx: ZapContext, raw) => {
    try {
      const { token } = ZAccessAuthRequest2FAEmailRequestSchema.parse(raw);

      const rateLimitResult = await request2FAEmailRateLimit.check({
        ip: ctx.metadata.requestMetadata.ipAddress ?? 'unknown',
        identifier: token,
      });

      assertRateLimit(rateLimitResult);

      const user = ctx.user;

      // Get document and recipient by token
      const envelope = await prisma.envelope.findFirst({
        where: {
          type: EnvelopeType.DOCUMENT,
          recipients: {
            some: {
              token,
            },
          },
        },
        include: {
          recipients: {
            where: {
              token,
            },
          },
        },
      });

      if (!envelope) {
        throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Document not found' });
      }

      const [recipient] = envelope.recipients;

      const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
        documentAuth: envelope.authOptions,
        recipientAuth: recipient.authOptions,
      });

      if (!derivedRecipientAccessAuth.includes(DocumentAuth.TWO_FACTOR_AUTH)) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: '2FA is not required for this document',
        });
      }

      // if (user && recipient.email !== user.email) {
      //   throw new TRPCError({
      //     code: 'UNAUTHORIZED',
      //     message: 'User does not match recipient',
      //   });
      // }

      const expiresAt = DateTime.now().plus({ minutes: TWO_FACTOR_EMAIL_EXPIRATION_MINUTES });

      await send2FATokenEmail({
        token,
        envelopeId: envelope.id,
      });

      return {
        success: true,
        expiresAt: expiresAt.toJSDate(),
      };
    } catch (error) {
      console.error('Error sending access auth 2FA email:', error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to send 2FA email',
      });
    }
  },

  'document.auditLog.find': async (ctx: ZapContext, raw) => {
    const {
      page,
      perPage,
      documentId,
      cursor,
      filterForRecentActivity,
      orderByColumn,
      orderByDirection,
    } = ZFindDocumentAuditLogsRequestSchema.parse(raw);
    const { teamId } = ctx;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    return await findDocumentAuditLogs({
      userId: ctx.user.id,
      teamId,
      page,
      perPage,
      documentId,
      cursor,
      filterForRecentActivity,
      orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
    });
  },

  'document.auditLog.download': async (ctx: ZapContext, raw) => {
    const { documentId } = ZDownloadDocumentAuditLogsRequestSchema.parse(raw);
    const { teamId } = ctx;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const envelope = await getEnvelopeById({
      id: {
        type: 'documentId',
        id: documentId,
      },
      type: EnvelopeType.DOCUMENT,
      userId: ctx.user.id,
      teamId,
    }).catch(() => null);

    if (!envelope) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have access to this document.',
      });
    }

    const certificatePdf = await generateAuditLogPdf({
      envelope,
      recipients: envelope.recipients,
      fields: envelope.fields,
      language: envelope.documentMeta.language,
      envelopeOwner: {
        email: envelope.user.email,
        name: envelope.user.name || '',
      },
      envelopeItems: envelope.envelopeItems.map((item) => item.title),
      pageWidth: PDF_SIZE_A4_72PPI.width,
      pageHeight: PDF_SIZE_A4_72PPI.height,
    });

    const result = await certificatePdf.save();

    const base64 = Buffer.from(result).toString('base64');

    return {
      data: base64,
      envelopeTitle: envelope.title,
    };
  },

  'document.inbox.find': async (ctx: ZapContext, raw) => {
    const { page, perPage } = ZFindInboxRequestSchema.parse(raw);

    const userId = ctx.user.id;

    const envelopes = await findInbox({
      userId,
      page,
      perPage,
    });

    return {
      ...envelopes,
      data: envelopes.data.map(mapEnvelopesToDocumentMany),
    };
  },

  'document.inbox.getCount': async (ctx: ZapContext, raw) => {
    const { readStatus } = ZGetInboxCountRequestSchema.parse(raw) ?? {};

    const userEmail = ctx.user.email;

    const count = await prisma.recipient.count({
      where: {
        email: userEmail,
        readStatus,
        role: {
          not: RecipientRole.CC,
        },
        envelope: {
          type: EnvelopeType.DOCUMENT,
          status: {
            not: DocumentStatus.DRAFT,
          },
          deletedAt: null,
        },
      },
    });

    return {
      count,
    };
  },

  'document.attachment.create': async (ctx: ZapContext, raw) => {
    const { documentId, data } = ZCreateAttachmentRequestSchema.parse(raw);
    const { teamId } = ctx;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: { documentId, label: data.label },
    });

    const envelope = await getEnvelopeById({
      id: {
        type: 'documentId',
        id: documentId,
      },
      userId,
      teamId,
      type: EnvelopeType.DOCUMENT,
    });

    const attachment = await createAttachment({
      envelopeId: envelope.id,
      teamId,
      userId,
      data,
    });

    return {
      id: attachment.id,
    };
  },

  'document.attachment.update': async (ctx: ZapContext, raw) => {
    const { id, data } = ZUpdateAttachmentRequestSchema.parse(raw);
    const { teamId } = ctx;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: { id },
    });

    await updateAttachment({
      id,
      userId,
      teamId,
      data,
    });

    return ZGenericSuccessResponse;
  },

  'document.attachment.delete': async (ctx: ZapContext, raw) => {
    const { id } = ZDeleteAttachmentRequestSchema.parse(raw);
    const { teamId } = ctx;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: { id },
    });

    await deleteAttachment({
      id,
      userId,
      teamId,
    });

    return ZGenericSuccessResponse;
  },

  'document.attachment.find': async (ctx: ZapContext, raw) => {
    const { documentId } = ZFindAttachmentsRequestSchema.parse(raw);
    const { teamId } = ctx;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: { documentId },
    });

    const envelope = await getEnvelopeById({
      id: {
        type: 'documentId',
        id: documentId,
      },
      userId,
      teamId,
      type: EnvelopeType.DOCUMENT,
    });

    const data = await findAttachmentsByEnvelopeId({
      envelopeId: envelope.id,
      teamId,
      userId,
    });

    return {
      data,
    };
  },
};
