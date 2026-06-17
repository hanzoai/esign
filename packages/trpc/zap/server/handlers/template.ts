// esign ZAP handlers — template router (14/14 procedures).
//
// Verbatim tRPC procedure bodies rewired to (ctx, raw). Input is validated by
// the SAME Zod schemas the tRPC procedures used; server-only functions and the
// per-route exported helper (getTemplatesByIdsRoute, ported inline here as
// template.getMany) are reused unchanged. The 13 inline tRPC procedures plus the
// out-of-file getTemplatesByIds route are ported here, dropping only .meta().
// Route keys mirror the FLAT tRPC router shape (see template-router.zap).
import type { Envelope } from '@prisma/client';
import { DocumentDataType, EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { jobs } from '@hanzo/sign-lib/jobs/client';
import { createDocumentData } from '@hanzo/sign-lib/server-only/document-data/create-document-data';
import { getDocumentWithDetailsById } from '@hanzo/sign-lib/server-only/document/get-document-with-details-by-id';
import { sendDocument } from '@hanzo/sign-lib/server-only/document/send-document';
import { createEnvelope } from '@hanzo/sign-lib/server-only/envelope/create-envelope';
import { duplicateEnvelope } from '@hanzo/sign-lib/server-only/envelope/duplicate-envelope';
import { getMultipleEnvelopeWhereInput } from '@hanzo/sign-lib/server-only/envelope/get-envelopes-by-ids';
import { updateEnvelope } from '@hanzo/sign-lib/server-only/envelope/update-envelope';
import { getServerLimits } from '@hanzo/sign-lib/server-only/limits/server';
import { createDocumentFromDirectTemplate } from '@hanzo/sign-lib/server-only/template/create-document-from-direct-template';
import { createDocumentFromTemplate } from '@hanzo/sign-lib/server-only/template/create-document-from-template';
import { createTemplateDirectLink } from '@hanzo/sign-lib/server-only/template/create-template-direct-link';
import { deleteTemplate } from '@hanzo/sign-lib/server-only/template/delete-template';
import { deleteTemplateDirectLink } from '@hanzo/sign-lib/server-only/template/delete-template-direct-link';
import { findTemplates } from '@hanzo/sign-lib/server-only/template/find-templates';
import { getTemplateById } from '@hanzo/sign-lib/server-only/template/get-template-by-id';
import { toggleTemplateDirectLink } from '@hanzo/sign-lib/server-only/template/toggle-template-direct-link';
import { putNormalizedPdfFileServerSide } from '@hanzo/sign-lib/universal/upload/put-file.server';
import { getPresignPostUrl } from '@hanzo/sign-lib/universal/upload/server-actions';
import { mapSecondaryIdToTemplateId } from '@hanzo/sign-lib/utils/envelope';
import { mapFieldToLegacyField } from '@hanzo/sign-lib/utils/fields';
import { mapRecipientToLegacyRecipient } from '@hanzo/sign-lib/utils/recipients';
import { mapEnvelopeToTemplateLite } from '@hanzo/sign-lib/utils/templates';
import { prisma } from '@hanzo/sign-prisma';

import { ZGenericSuccessResponse } from '../../../server/schema';
import { ZGetTemplatesByIdsRequestSchema } from '../../../server/template-router/get-templates-by-ids.types';
import {
  ZBulkSendTemplateMutationSchema,
  ZCreateDocumentFromDirectTemplateRequestSchema,
  ZCreateDocumentFromTemplateRequestSchema,
  ZCreateTemplateDirectLinkRequestSchema,
  ZCreateTemplateMutationSchema,
  ZCreateTemplateV2RequestSchema,
  ZDeleteTemplateDirectLinkRequestSchema,
  ZDeleteTemplateMutationSchema,
  ZDuplicateTemplateMutationSchema,
  ZFindTemplatesRequestSchema,
  ZGetTemplateByIdRequestSchema,
  ZToggleTemplateDirectLinkRequestSchema,
  ZUpdateTemplateRequestSchema,
} from '../../../server/template-router/schema';
import type { ZapContext } from '../context';
import type { ZapRouteMap } from '../dispatch';

export const templateRoutes: ZapRouteMap = {
  'template.findTemplates': async (ctx: ZapContext, raw) => {
    const input = ZFindTemplatesRequestSchema.parse(raw);
    const { teamId } = ctx;

    ctx.logger.info({
      input: {
        folderId: input.folderId,
      },
    });

    const result = await findTemplates({
      userId: ctx.user.id,
      teamId,
      ...input,
    });

    // Remapping for backwards compatibility.
    return {
      ...result,
      data: result.data.map((envelope) => {
        const legacyTemplateId = mapSecondaryIdToTemplateId(envelope.secondaryId);

        return {
          id: legacyTemplateId,
          envelopeId: envelope.id,
          type: envelope.templateType,
          visibility: envelope.visibility,
          externalId: envelope.externalId,
          title: envelope.title,
          userId: envelope.userId,
          teamId: envelope.teamId,
          authOptions: envelope.authOptions,
          createdAt: envelope.createdAt,
          updatedAt: envelope.updatedAt,
          publicTitle: envelope.publicTitle,
          publicDescription: envelope.publicDescription,
          folderId: envelope.folderId,
          useLegacyFieldInsertion: envelope.useLegacyFieldInsertion,
          team: envelope.team,
          fields: envelope.fields.map((field) => mapFieldToLegacyField(field, envelope)),
          recipients: envelope.recipients.map((recipient) =>
            mapRecipientToLegacyRecipient(recipient, envelope),
          ),
          templateMeta: envelope.documentMeta,
          directLink: envelope.directLink,
        };
      }),
    };
  },

  'template.getTemplateById': async (ctx: ZapContext, raw) => {
    const input = ZGetTemplateByIdRequestSchema.parse(raw);
    const { teamId } = ctx;
    const { templateId } = input;

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    return await getTemplateById({
      id: {
        type: 'templateId',
        id: templateId,
      },
      userId: ctx.user.id,
      teamId,
    });
  },

  'template.getMany': async (ctx: ZapContext, raw) => {
    const input = ZGetTemplatesByIdsRequestSchema.parse(raw);
    const { teamId, user } = ctx;
    const { templateIds } = input;

    ctx.logger.info({
      input: {
        templateIds,
      },
    });

    const { envelopeWhereInput } = await getMultipleEnvelopeWhereInput({
      ids: {
        type: 'templateId',
        ids: templateIds,
      },
      userId: user.id,
      teamId,
      type: EnvelopeType.TEMPLATE,
    });

    const envelopes = await prisma.envelope.findMany({
      where: envelopeWhereInput,
      include: {
        recipients: {
          orderBy: {
            id: 'asc',
          },
        },
        envelopeItems: {
          select: {
            documentData: true,
          },
        },
        fields: true,
        team: {
          select: {
            id: true,
            url: true,
          },
        },
        documentMeta: {
          select: {
            signingOrder: true,
            distributionMethod: true,
          },
        },
        directLink: {
          select: {
            token: true,
            enabled: true,
          },
        },
      },
    });

    const templates = envelopes.map((envelope) => {
      const legacyTemplateId = mapSecondaryIdToTemplateId(envelope.secondaryId);

      const firstTemplateDocumentData = envelope.envelopeItems[0].documentData;

      return {
        id: legacyTemplateId,
        envelopeId: envelope.id,
        type: envelope.templateType,
        visibility: envelope.visibility,
        externalId: envelope.externalId,
        title: envelope.title,
        userId: envelope.userId,
        teamId: envelope.teamId,
        authOptions: envelope.authOptions,
        createdAt: envelope.createdAt,
        updatedAt: envelope.updatedAt,
        publicTitle: envelope.publicTitle,
        publicDescription: envelope.publicDescription,
        folderId: envelope.folderId,
        useLegacyFieldInsertion: envelope.useLegacyFieldInsertion,
        team: envelope.team
          ? {
              id: envelope.team.id,
              url: envelope.team.url,
            }
          : null,
        fields: envelope.fields.map((field) => mapFieldToLegacyField(field, envelope)),
        recipients: envelope.recipients.map((recipient) =>
          mapRecipientToLegacyRecipient(recipient, envelope),
        ),
        templateMeta: envelope.documentMeta
          ? {
              signingOrder: envelope.documentMeta.signingOrder,
              distributionMethod: envelope.documentMeta.distributionMethod,
            }
          : null,
        directLink: envelope.directLink
          ? {
              token: envelope.directLink.token,
              enabled: envelope.directLink.enabled,
            }
          : null,
        templateDocumentDataId: firstTemplateDocumentData.id, // Backwards compatibility.
      };
    });

    return {
      data: templates,
    };
  },

  'template.createTemplate': async (ctx: ZapContext, raw) => {
    const input = ZCreateTemplateMutationSchema.parse(raw);
    const { teamId } = ctx;

    const { payload, file } = input;

    const {
      title,
      folderId,
      externalId,
      visibility,
      globalAccessAuth,
      globalActionAuth,
      publicTitle,
      publicDescription,
      type,
      meta,
      attachments,
    } = payload;

    const { id: templateDocumentDataId } = await putNormalizedPdfFileServerSide(file, {
      flattenForm: false,
    });

    ctx.logger.info({
      input: {
        folderId,
      },
    });

    const envelope = await createEnvelope({
      userId: ctx.user.id,
      teamId,
      internalVersion: 1,
      data: {
        type: EnvelopeType.TEMPLATE,
        title,
        envelopeItems: [
          {
            documentDataId: templateDocumentDataId,
          },
        ],
        folderId,
        externalId: externalId ?? undefined,
        visibility,
        globalAccessAuth,
        globalActionAuth,
        templateType: type,
        publicTitle,
        publicDescription,
      },
      meta,
      attachments,
      requestMetadata: ctx.metadata,
    });

    return {
      envelopeId: envelope.id,
      id: mapSecondaryIdToTemplateId(envelope.secondaryId),
    };
  },

  'template.createTemplateTemporary': async (ctx: ZapContext, raw) => {
    const input = ZCreateTemplateV2RequestSchema.parse(raw);
    const { teamId, user } = ctx;

    const {
      title,
      folderId,
      externalId,
      visibility,
      globalAccessAuth,
      globalActionAuth,
      publicTitle,
      publicDescription,
      type,
      meta,
      attachments,
    } = input;

    const fileName = title.endsWith('.pdf') ? title : `${title}.pdf`;

    const { url, key } = await getPresignPostUrl(fileName, 'application/pdf');

    const templateDocumentData = await createDocumentData({
      data: key,
      type: DocumentDataType.S3_PATH,
    });

    const createdTemplate = await createEnvelope({
      userId: user.id,
      teamId,
      internalVersion: 1,
      data: {
        type: EnvelopeType.TEMPLATE,
        title,
        envelopeItems: [
          {
            documentDataId: templateDocumentData.id,
          },
        ],
        folderId,
        externalId: externalId ?? undefined,
        visibility,
        globalAccessAuth,
        globalActionAuth,
        templateType: type,
        publicTitle,
        publicDescription,
      },
      meta,
      attachments,
      requestMetadata: ctx.metadata,
    });

    const legacyTemplateId = mapSecondaryIdToTemplateId(createdTemplate.secondaryId);

    const fullTemplate = await getTemplateById({
      id: {
        type: 'templateId',
        id: legacyTemplateId,
      },
      userId: user.id,
      teamId,
    });

    return {
      template: fullTemplate,
      uploadUrl: url,
    };
  },

  'template.updateTemplate': async (ctx: ZapContext, raw) => {
    const input = ZUpdateTemplateRequestSchema.parse(raw);
    const { teamId } = ctx;
    const { templateId, data, meta } = input;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    const envelope = await updateEnvelope({
      userId,
      teamId,
      id: {
        type: 'templateId',
        id: templateId,
      },
      data: {
        ...data,
        templateType: data?.type, // Backwards compatibility.
      },
      meta,
      requestMetadata: ctx.metadata,
    });

    return mapEnvelopeToTemplateLite(envelope);
  },

  'template.duplicateTemplate': async (ctx: ZapContext, raw) => {
    const input = ZDuplicateTemplateMutationSchema.parse(raw);
    const { teamId } = ctx;
    const { templateId } = input;

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    const duplicatedEnvelope = await duplicateEnvelope({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'templateId',
        id: templateId,
      },
    });

    return mapEnvelopeToTemplateLite(duplicatedEnvelope.envelope);
  },

  'template.deleteTemplate': async (ctx: ZapContext, raw) => {
    const input = ZDeleteTemplateMutationSchema.parse(raw);
    const { teamId } = ctx;
    const { templateId } = input;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    await deleteTemplate({
      userId,
      id: {
        type: 'templateId',
        id: templateId,
      },
      teamId,
    });

    return ZGenericSuccessResponse;
  },

  'template.createDocumentFromTemplate': async (ctx: ZapContext, raw) => {
    const input = ZCreateDocumentFromTemplateRequestSchema.parse(raw);
    const { teamId } = ctx;
    const {
      templateId,
      recipients,
      distributeDocument,
      customDocumentDataId,
      folderId,
      prefillFields,
      externalId,
      override,
      attachments,
      formValues,
    } = input;

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    const limits = await getServerLimits({ userId: ctx.user.id, teamId });

    if (limits.remaining.documents === 0) {
      throw new Error('You have reached your document limit.');
    }

    // Backwards compatibility mapping since we need the envelopeItemId for the custom document data.
    const customDocumentData = customDocumentDataId
      ? [
          {
            documentDataId: customDocumentDataId,
            envelopeItemId: undefined,
          },
        ]
      : input.customDocumentData || [];

    const envelope: Envelope = await createDocumentFromTemplate({
      id: {
        type: 'templateId',
        id: templateId,
      },
      teamId,
      userId: ctx.user.id,
      recipients,
      customDocumentData,
      requestMetadata: ctx.metadata,
      folderId,
      prefillFields,
      externalId,
      override,
      attachments,
      formValues,
    });

    if (distributeDocument) {
      await sendDocument({
        id: {
          type: 'envelopeId',
          id: envelope.id,
        },
        userId: ctx.user.id,
        teamId,
        requestMetadata: ctx.metadata,
      }).catch((err) => {
        console.error(err);

        throw new AppError('DOCUMENT_SEND_FAILED');
      });
    }

    return getDocumentWithDetailsById({
      id: {
        type: 'envelopeId',
        id: envelope.id,
      },
      userId: ctx.user.id,
      teamId,
    });
  },

  'template.createDocumentFromDirectTemplate': async (ctx: ZapContext, raw) => {
    const input = ZCreateDocumentFromDirectTemplateRequestSchema.parse(raw);
    const {
      directRecipientName,
      directRecipientEmail,
      directTemplateToken,
      directTemplateExternalId,
      signedFieldValues,
      templateUpdatedAt,
      nextSigner,
    } = input;

    ctx.logger.info({
      input: {
        directTemplateToken,
      },
    });

    return await createDocumentFromDirectTemplate({
      directRecipientName,
      directRecipientEmail,
      directTemplateToken,
      directTemplateExternalId,
      signedFieldValues,
      templateUpdatedAt,
      user: ctx.user
        ? {
            id: ctx.user.id,
            name: ctx.user.name || undefined,
            email: ctx.user.email,
          }
        : undefined,
      nextSigner,
      requestMetadata: ctx.metadata,
    });
  },

  'template.createTemplateDirectLink': async (ctx: ZapContext, raw) => {
    const input = ZCreateTemplateDirectLinkRequestSchema.parse(raw);
    const { teamId } = ctx;
    const { templateId, directRecipientId } = input;

    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        templateId,
        directRecipientId,
      },
    });

    const template = await getTemplateById({
      id: {
        type: 'templateId',
        id: templateId,
      },
      teamId,
      userId: ctx.user.id,
    });

    const limits = await getServerLimits({ userId: ctx.user.id, teamId: template.teamId });

    if (limits.remaining.directTemplates === 0) {
      throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
        message: 'You have reached your direct templates limit.',
      });
    }

    return await createTemplateDirectLink({
      userId,
      teamId,
      id: {
        type: 'templateId',
        id: templateId,
      },
      directRecipientId,
    });
  },

  'template.deleteTemplateDirectLink': async (ctx: ZapContext, raw) => {
    const input = ZDeleteTemplateDirectLinkRequestSchema.parse(raw);
    const { teamId } = ctx;
    const { templateId } = input;

    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    await deleteTemplateDirectLink({ userId, teamId, templateId });

    return ZGenericSuccessResponse;
  },

  'template.toggleTemplateDirectLink': async (ctx: ZapContext, raw) => {
    const input = ZToggleTemplateDirectLinkRequestSchema.parse(raw);
    const { teamId } = ctx;
    const { templateId, enabled } = input;

    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    return await toggleTemplateDirectLink({ userId, teamId, templateId, enabled });
  },

  'template.uploadBulkSend': async (ctx: ZapContext, raw) => {
    const input = ZBulkSendTemplateMutationSchema.parse(raw);
    const { templateId, teamId, csv, sendImmediately } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        templateId,
        teamId,
      },
    });

    if (csv.length > 4 * 1024 * 1024) {
      throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
        message: 'File size exceeds 4MB limit',
        statusCode: 400,
      });
    }

    const template = await getTemplateById({
      id: {
        type: 'templateId',
        id: templateId,
      },
      teamId,
      userId: user.id,
    });

    if (!template) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Template not found',
      });
    }

    await jobs.triggerJob({
      name: 'internal.bulk-send-template',
      payload: {
        userId: user.id,
        teamId,
        templateId,
        csvContent: csv,
        sendImmediately,
        requestMetadata: ctx.metadata.requestMetadata,
      },
    });

    return { success: true };
  },
};
