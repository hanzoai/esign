// esign ZAP handlers — envelope router (38/38 procedures).
//
// Verbatim tRPC procedure bodies rewired to (ctx, raw). Input is validated by
// the SAME Zod schema the tRPC procedure used; server-only functions and the
// per-route exported helpers (createEnvelopeRouteCaller, the by-token helpers)
// are reused unchanged. Route keys mirror the tRPC nested router shape (see
// envelope-router.zap), folding the attachment / recipient / field / item /
// bulk / auditLog / editor subtrees into dotted keys.
//
// Route keys (dotted, matching the tRPC nested router shape):
//   envelope.attachment.find / create / update / delete
//   envelope.item.getMany / getManyByToken / createMany / updateMany / delete / download
//   envelope.recipient.get / createMany / updateMany / delete / set
//   envelope.field.get / createMany / updateMany / delete / set / sign
//   envelope.find
//   envelope.auditLog.find
//   envelope.bulk.move / delete
//   envelope.editor.get
//   envelope.get / getMany / create / use / update / delete / duplicate /
//   envelope.distribute / redistribute / signingStatus
//
// Public/maybe-auth procedures (item.getManyByToken, signingStatus,
// attachment.find, field.sign) keep their verbatim optional-chaining guards;
// ZapContext.user is always present (auth at connection), so the guards are
// inert but preserved for byte-for-byte fidelity.
import {
  DocumentStatus,
  EnvelopeType,
  FieldType,
  RecipientRole,
  SigningStatus,
} from '@prisma/client';
import pMap from 'p-map';
import { match } from 'ts-pattern';

import { isBase64Image } from '@hanzo/esign-lib/constants/signatures';
import { TEAM_DOCUMENT_VISIBILITY_MAP } from '@hanzo/esign-lib/constants/teams';
import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { updateDocumentMeta } from '@hanzo/esign-lib/server-only/document-meta/upsert-document-meta';
import { deleteDocument } from '@hanzo/esign-lib/server-only/document/delete-document';
import { resendDocument } from '@hanzo/esign-lib/server-only/document/resend-document';
import { sendDocument } from '@hanzo/esign-lib/server-only/document/send-document';
import { validateFieldAuth } from '@hanzo/esign-lib/server-only/document/validate-field-auth';
import { createAttachment } from '@hanzo/esign-lib/server-only/envelope-attachment/create-attachment';
import { deleteAttachment } from '@hanzo/esign-lib/server-only/envelope-attachment/delete-attachment';
import { findAttachmentsByEnvelopeId } from '@hanzo/esign-lib/server-only/envelope-attachment/find-attachments-by-envelope-id';
import { findAttachmentsByToken } from '@hanzo/esign-lib/server-only/envelope-attachment/find-attachments-by-token';
import { updateAttachment } from '@hanzo/esign-lib/server-only/envelope-attachment/update-attachment';
import { UNSAFE_createEnvelopeItems } from '@hanzo/esign-lib/server-only/envelope-item/create-envelope-items';
import { UNSAFE_deleteEnvelopeItem } from '@hanzo/esign-lib/server-only/envelope-item/delete-envelope-item';
import { UNSAFE_updateEnvelopeItems } from '@hanzo/esign-lib/server-only/envelope-item/update-envelope-items';
import { duplicateEnvelope } from '@hanzo/esign-lib/server-only/envelope/duplicate-envelope';
import { findEnvelopes } from '@hanzo/esign-lib/server-only/envelope/find-envelopes';
import { getEditorEnvelopeById } from '@hanzo/esign-lib/server-only/envelope/get-editor-envelope-by-id';
import {
  getEnvelopeById,
  getEnvelopeWhereInput,
} from '@hanzo/esign-lib/server-only/envelope/get-envelope-by-id';
import {
  getEnvelopesByIds,
  getMultipleEnvelopeWhereInput,
} from '@hanzo/esign-lib/server-only/envelope/get-envelopes-by-ids';
import { updateEnvelope } from '@hanzo/esign-lib/server-only/envelope/update-envelope';
import { createEnvelopeFields } from '@hanzo/esign-lib/server-only/field/create-envelope-fields';
import { getFieldById } from '@hanzo/esign-lib/server-only/field/get-field-by-id';
import { setFieldsForDocument } from '@hanzo/esign-lib/server-only/field/set-fields-for-document';
import { setFieldsForTemplate } from '@hanzo/esign-lib/server-only/field/set-fields-for-template';
import { updateEnvelopeFields } from '@hanzo/esign-lib/server-only/field/update-envelope-fields';
import { getServerLimits } from '@hanzo/esign-lib/server-only/limits/server';
import { createEnvelopeRecipients } from '@hanzo/esign-lib/server-only/recipient/create-envelope-recipients';
import { deleteEnvelopeRecipient } from '@hanzo/esign-lib/server-only/recipient/delete-envelope-recipient';
import { setDocumentRecipients } from '@hanzo/esign-lib/server-only/recipient/set-document-recipients';
import { setTemplateRecipients } from '@hanzo/esign-lib/server-only/recipient/set-template-recipients';
import { updateEnvelopeRecipients } from '@hanzo/esign-lib/server-only/recipient/update-envelope-recipients';
import { createDocumentFromTemplate } from '@hanzo/esign-lib/server-only/template/create-document-from-template';
import { deleteTemplate } from '@hanzo/esign-lib/server-only/template/delete-template';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@hanzo/esign-lib/types/document-audit-logs';
import type { FindResultResponse } from '@hanzo/esign-lib/types/search-params';
import { putNormalizedPdfFileServerSide } from '@hanzo/esign-lib/universal/upload/put-file.server';
import { parseDocumentAuditLogData } from '@hanzo/esign-lib/utils/document-audit-logs';
import { createDocumentAuditLogData } from '@hanzo/esign-lib/utils/document-audit-logs';
import { canEnvelopeItemsBeModified } from '@hanzo/esign-lib/utils/envelope';
import { extractFieldInsertionValues } from '@hanzo/esign-lib/utils/envelope-signing';
import { formatSigningLink } from '@hanzo/esign-lib/utils/recipients';
import { canRecipientFieldsBeModified } from '@hanzo/esign-lib/utils/recipients';
import { buildTeamWhereQuery } from '@hanzo/esign-lib/utils/teams';
import { prisma } from '@hanzo/esign-prisma';

import { ZCreateAttachmentRequestSchema } from '../../../server/envelope-router/attachment/create-attachment.types';
import { ZDeleteAttachmentRequestSchema } from '../../../server/envelope-router/attachment/delete-attachment.types';
import { ZFindAttachmentsRequestSchema } from '../../../server/envelope-router/attachment/find-attachments.types';
import { ZUpdateAttachmentRequestSchema } from '../../../server/envelope-router/attachment/update-attachment.types';
import { ZBulkDeleteEnvelopesRequestSchema } from '../../../server/envelope-router/bulk-delete-envelopes.types';
import { ZBulkMoveEnvelopesRequestSchema } from '../../../server/envelope-router/bulk-move-envelopes.types';
import { createEnvelopeRouteCaller } from '../../../server/envelope-router/create-envelope';
import { ZCreateEnvelopeItemsRequestSchema } from '../../../server/envelope-router/create-envelope-items.types';
import { ZCreateEnvelopeRequestSchema } from '../../../server/envelope-router/create-envelope.types';
import { ZDeleteEnvelopeItemRequestSchema } from '../../../server/envelope-router/delete-envelope-item.types';
import { ZDeleteEnvelopeRequestSchema } from '../../../server/envelope-router/delete-envelope.types';
import { ZDistributeEnvelopeRequestSchema } from '../../../server/envelope-router/distribute-envelope.types';
import { ZDownloadEnvelopeItemRequestSchema } from '../../../server/envelope-router/download-envelope-item.types';
import { ZDuplicateEnvelopeRequestSchema } from '../../../server/envelope-router/duplicate-envelope.types';
import { ZCreateEnvelopeFieldsRequestSchema } from '../../../server/envelope-router/envelope-fields/create-envelope-fields.types';
import { ZDeleteEnvelopeFieldRequestSchema } from '../../../server/envelope-router/envelope-fields/delete-envelope-field.types';
import { ZGetEnvelopeFieldRequestSchema } from '../../../server/envelope-router/envelope-fields/get-envelope-field.types';
import { ZUpdateEnvelopeFieldsRequestSchema } from '../../../server/envelope-router/envelope-fields/update-envelope-fields.types';
import { ZCreateEnvelopeRecipientsRequestSchema } from '../../../server/envelope-router/envelope-recipients/create-envelope-recipients.types';
import { ZDeleteEnvelopeRecipientRequestSchema } from '../../../server/envelope-router/envelope-recipients/delete-envelope-recipient.types';
import { ZGetEnvelopeRecipientRequestSchema } from '../../../server/envelope-router/envelope-recipients/get-envelope-recipient.types';
import { ZUpdateEnvelopeRecipientsRequestSchema } from '../../../server/envelope-router/envelope-recipients/update-envelope-recipients.types';
import { ZFindEnvelopeAuditLogsRequestSchema } from '../../../server/envelope-router/find-envelope-audit-logs.types';
import { ZFindEnvelopesRequestSchema } from '../../../server/envelope-router/find-envelopes.types';
import { ZGetEditorEnvelopeRequestSchema } from '../../../server/envelope-router/get-editor-envelope.types';
import { ZGetEnvelopeItemsByTokenRequestSchema } from '../../../server/envelope-router/get-envelope-items-by-token.types';
import { ZGetEnvelopeItemsRequestSchema } from '../../../server/envelope-router/get-envelope-items.types';
import { ZGetEnvelopeRequestSchema } from '../../../server/envelope-router/get-envelope.types';
import { ZGetEnvelopesByIdsRequestSchema } from '../../../server/envelope-router/get-envelopes-by-ids.types';
import { ZRedistributeEnvelopeRequestSchema } from '../../../server/envelope-router/redistribute-envelope.types';
import { ZSetEnvelopeFieldsRequestSchema } from '../../../server/envelope-router/set-envelope-fields.types';
import { ZSetEnvelopeRecipientsRequestSchema } from '../../../server/envelope-router/set-envelope-recipients.types';
import { ZSignEnvelopeFieldRequestSchema } from '../../../server/envelope-router/sign-envelope-field.types';
import { ZSigningStatusEnvelopeRequestSchema } from '../../../server/envelope-router/signing-status-envelope.types';
import { ZUpdateEnvelopeItemsRequestSchema } from '../../../server/envelope-router/update-envelope-items.types';
import { ZUpdateEnvelopeRequestSchema } from '../../../server/envelope-router/update-envelope.types';
import { ZUseEnvelopeRequestSchema } from '../../../server/envelope-router/use-envelope.types';
import { ZGenericSuccessResponse } from '../../../server/schema';
import type { ZapContext } from '../context';
import type { ZapRouteMap } from '../dispatch';

// ---------------------------------------------------------------------------
// envelope.item.getManyByToken helpers (verbatim from get-envelope-items-by-token).
// ---------------------------------------------------------------------------

const handleGetEnvelopeItemsByToken = async ({
  envelopeId,
  token,
}: {
  envelopeId: string;
  token: string;
}) => {
  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
      type: EnvelopeType.DOCUMENT, // You cannot get template envelope items by token.
      recipients: {
        some: {
          token,
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

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope could not be found',
    });
  }

  return {
    envelopeItems: envelope.envelopeItems,
  };
};

const handleGetEnvelopeItemsByUser = async ({
  envelopeId,
  userId,
  teamId,
}: {
  envelopeId: string;
  userId: number;
  teamId: number;
}) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'envelopeId',
      id: envelopeId,
    },
    type: null,
    userId,
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
    envelopeItems: envelope.envelopeItems,
  };
};

export const envelopeRoutes: ZapRouteMap = {
  'envelope.attachment.find': async (ctx: ZapContext, raw) => {
    const { envelopeId, token } = ZFindAttachmentsRequestSchema.parse(raw);

    ctx.logger.info({
      input: { envelopeId },
    });

    if (token) {
      const data = await findAttachmentsByToken({ envelopeId, token });

      return {
        data,
      };
    }

    const { teamId } = ctx;
    const userId = ctx.user?.id;

    if (!userId || !teamId) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You must be authenticated to access this resource',
      });
    }

    const data = await findAttachmentsByEnvelopeId({ envelopeId, teamId, userId });

    return {
      data,
    };
  },

  'envelope.attachment.create': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const userId = ctx.user.id;

    const { envelopeId, data } = ZCreateAttachmentRequestSchema.parse(raw);

    ctx.logger.info({
      input: { envelopeId, label: data.label },
    });

    const attachment = await createAttachment({
      envelopeId,
      teamId,
      userId,
      data,
    });

    return {
      id: attachment.id,
    };
  },

  'envelope.attachment.update': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const userId = ctx.user.id;

    const { id, data } = ZUpdateAttachmentRequestSchema.parse(raw);

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

  'envelope.attachment.delete': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const userId = ctx.user.id;

    const { id } = ZDeleteAttachmentRequestSchema.parse(raw);

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

  'envelope.item.getMany': async (ctx: ZapContext, raw) => {
    const { teamId, user } = ctx;
    const { envelopeId } = ZGetEnvelopeItemsRequestSchema.parse(raw);

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
  },

  'envelope.item.getManyByToken': async (ctx: ZapContext, raw) => {
    const { teamId, user } = ctx;

    const { envelopeId, access } = ZGetEnvelopeItemsByTokenRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
        access,
      },
    });

    if (access.type === 'user') {
      if (!user || !teamId) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'User not found',
        });
      }

      const { envelopeItems: data } = await handleGetEnvelopeItemsByUser({
        envelopeId,
        userId: user.id,
        teamId,
      });

      return {
        data,
      };
    }

    const { envelopeItems: data } = await handleGetEnvelopeItemsByToken({
      envelopeId,
      token: access.token,
    });

    return {
      data,
    };
  },

  'envelope.item.createMany': async (ctx: ZapContext, raw) => {
    const { user, teamId, metadata } = ctx;
    const { payload, files } = ZCreateEnvelopeItemsRequestSchema.parse(raw);
    const { envelopeId } = payload;

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
        recipients: true,
        envelopeItems: {
          orderBy: {
            order: 'asc',
          },
        },
        team: {
          select: {
            organisation: {
              select: {
                organisationClaim: true,
              },
            },
          },
        },
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    if (!canEnvelopeItemsBeModified(envelope, envelope.recipients)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope item is not editable',
      });
    }

    const organisationClaim = envelope.team.organisation.organisationClaim;

    const remainingEnvelopeItems =
      organisationClaim.envelopeItemCount - envelope.envelopeItems.length - files.length;

    if (remainingEnvelopeItems < 0) {
      throw new AppError('ENVELOPE_ITEM_LIMIT_EXCEEDED', {
        message: `You cannot upload more than ${organisationClaim.envelopeItemCount} envelope items`,
        statusCode: 400,
      });
    }

    const result = await UNSAFE_createEnvelopeItems({
      files: files.map((file) => ({
        file,
      })),
      envelope,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      apiRequestMetadata: metadata,
    });

    return {
      data: result,
    };
  },

  'envelope.item.updateMany': async (ctx: ZapContext, raw) => {
    const { user, teamId } = ctx;
    const { envelopeId, data } = ZUpdateEnvelopeItemsRequestSchema.parse(raw);

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
        recipients: true,
        envelopeItems: true,
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    if (data.length === 0) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Envelope items are required',
      });
    }

    // Note: This logic is duplicated in many places. If we plan to allow changing title/order
    // even after the envelope has been sent, make sure to update it everywhere including
    // embedding routes.
    if (!canEnvelopeItemsBeModified(envelope, envelope.recipients)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope item is not editable',
      });
    }

    // Check that the items belong to the envelope.
    const itemsBelongToEnvelope = data.every((item) =>
      envelope.envelopeItems.some(({ id }) => item.envelopeItemId === id),
    );

    if (!itemsBelongToEnvelope) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'One or more envelope items to update do not exist',
      });
    }

    const updatedEnvelopeItems = await UNSAFE_updateEnvelopeItems({
      envelopeId,
      data,
    });

    return {
      data: updatedEnvelopeItems,
    };
  },

  'envelope.item.delete': async (ctx: ZapContext, raw) => {
    const { user, teamId, metadata } = ctx;
    const { envelopeId, envelopeItemId } = ZDeleteEnvelopeItemRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
        envelopeItemId,
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
        recipients: true,
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    if (!canEnvelopeItemsBeModified(envelope, envelope.recipients)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope item is not editable',
      });
    }

    await UNSAFE_deleteEnvelopeItem({
      envelopeId,
      envelopeItemId,
      user,
      apiRequestMetadata: metadata,
    });

    return ZGenericSuccessResponse;
  },

  'envelope.item.download': async (ctx: ZapContext, raw) => {
    const { envelopeItemId, version } = ZDownloadEnvelopeItemRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeItemId,
        version,
      },
    });

    // This endpoint is purely for V2 API, which is implemented in the Hono remix server.
    throw new Error('NOT_IMPLEMENTED');
  },

  'envelope.recipient.get': async (ctx: ZapContext, raw) => {
    const { teamId, user } = ctx;
    const { recipientId } = ZGetEnvelopeRecipientRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        recipientId,
      },
    });

    const recipient = await prisma.recipient.findFirst({
      where: {
        id: recipientId,
        envelope: {
          team: buildTeamWhereQuery({ teamId, userId: user.id }),
        },
      },
      include: {
        fields: true,
      },
    });

    if (!recipient) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Recipient not found',
      });
    }

    return recipient;
  },

  'envelope.recipient.createMany': async (ctx: ZapContext, raw) => {
    const { user, teamId, metadata } = ctx;
    const { envelopeId, data: recipients } = ZCreateEnvelopeRecipientsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const { recipients: data } = await createEnvelopeRecipients({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      recipients,
      requestMetadata: metadata,
    });

    return {
      data,
    };
  },

  'envelope.recipient.updateMany': async (ctx: ZapContext, raw) => {
    const { user, teamId } = ctx;
    const { envelopeId, data: recipients } = ZUpdateEnvelopeRecipientsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const { recipients: data } = await updateEnvelopeRecipients({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      recipients,
      requestMetadata: ctx.metadata,
    });

    return {
      data,
    };
  },

  'envelope.recipient.delete': async (ctx: ZapContext, raw) => {
    const { user, teamId, metadata } = ctx;
    const { recipientId } = ZDeleteEnvelopeRecipientRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        recipientId,
      },
    });

    await deleteEnvelopeRecipient({
      userId: user.id,
      teamId,
      recipientId,
      requestMetadata: metadata,
    });

    return ZGenericSuccessResponse;
  },

  'envelope.recipient.set': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { envelopeId, envelopeType, recipients } = ZSetEnvelopeRecipientsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const { recipients: data } = await match(envelopeType)
      .with(EnvelopeType.DOCUMENT, async () =>
        setDocumentRecipients({
          userId: ctx.user.id,
          teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
          recipients,
          requestMetadata: ctx.metadata,
        }),
      )
      .with(EnvelopeType.TEMPLATE, async () =>
        setTemplateRecipients({
          userId: ctx.user.id,
          teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
          recipients,
        }),
      )
      .exhaustive();

    return {
      data,
    };
  },

  'envelope.field.get': async (ctx: ZapContext, raw) => {
    const { teamId, user } = ctx;
    const { fieldId } = ZGetEnvelopeFieldRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    return await getFieldById({
      userId: user.id,
      teamId,
      fieldId,
    });
  },

  'envelope.field.createMany': async (ctx: ZapContext, raw) => {
    const { user, teamId, metadata } = ctx;
    const { envelopeId, data: fields } = ZCreateEnvelopeFieldsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const { fields: data } = await createEnvelopeFields({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      fields,
      requestMetadata: metadata,
    });

    return {
      data,
    };
  },

  'envelope.field.updateMany': async (ctx: ZapContext, raw) => {
    const { user, teamId } = ctx;
    const { envelopeId, data: fields } = ZUpdateEnvelopeFieldsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const { fields: data } = await updateEnvelopeFields({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: null,
      fields,
      requestMetadata: ctx.metadata,
    });

    return {
      data,
    };
  },

  'envelope.field.delete': async (ctx: ZapContext, raw) => {
    const { user, teamId, metadata } = ctx;
    const { fieldId } = ZDeleteEnvelopeFieldRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    const unsafeField = await prisma.field.findUnique({
      where: {
        id: fieldId,
      },
      select: {
        envelopeId: true,
      },
    });

    if (!unsafeField) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Field not found',
      });
    }

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'envelopeId',
        id: unsafeField.envelopeId,
      },
      type: null,
      userId: user.id,
      teamId,
    });

    const envelope = await prisma.envelope.findUnique({
      where: envelopeWhereInput,
      include: {
        recipients: {
          include: {
            fields: true,
          },
        },
      },
    });

    const recipientWithFields = envelope?.recipients.find((recipient) =>
      recipient.fields.some((field) => field.id === fieldId),
    );
    const fieldToDelete = recipientWithFields?.fields.find((field) => field.id === fieldId);

    if (!envelope || !recipientWithFields || !fieldToDelete) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Field not found',
      });
    }

    if (envelope.completedAt) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope already complete',
      });
    }

    // Check whether the recipient associated with the field can have new fields created.
    if (!canRecipientFieldsBeModified(recipientWithFields, recipientWithFields.fields)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Recipient has already interacted with the document.',
      });
    }

    await prisma.$transaction(async (tx) => {
      const deletedField = await tx.field.delete({
        where: {
          id: fieldToDelete.id,
          envelopeId: envelope.id,
        },
      });

      // Handle field deleted audit log.
      if (envelope.type === EnvelopeType.DOCUMENT) {
        await tx.documentAuditLog.create({
          data: createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_DELETED,
            envelopeId: envelope.id,
            metadata,
            data: {
              fieldId: deletedField.secondaryId,
              fieldRecipientEmail: recipientWithFields.email,
              fieldRecipientId: deletedField.recipientId,
              fieldType: deletedField.type,
            },
          }),
        });
      }

      return deletedField;
    });

    return ZGenericSuccessResponse;
  },

  'envelope.field.set': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { envelopeId, envelopeType, fields } = ZSetEnvelopeFieldsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const result = await match(envelopeType)
      .with(EnvelopeType.DOCUMENT, async () =>
        setFieldsForDocument({
          userId: ctx.user.id,
          teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
          fields: fields.map((field) => ({
            ...field,
            pageNumber: field.page,
            pageX: field.positionX,
            pageY: field.positionY,
            pageWidth: field.width,
            pageHeight: field.height,
          })),
          requestMetadata: ctx.metadata,
        }),
      )
      .with(EnvelopeType.TEMPLATE, async () =>
        setFieldsForTemplate({
          userId: ctx.user.id,
          teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
          fields: fields.map((field) => ({
            ...field,
            pageNumber: field.page,
            pageX: field.positionX,
            pageY: field.positionY,
            pageWidth: field.width,
            pageHeight: field.height,
          })),
        }),
      )
      .exhaustive();

    return {
      data: result.fields.map((field) => ({
        ...field,
        formId: field.formId,
      })),
    };
  },

  'envelope.field.sign': async (ctx: ZapContext, raw) => {
    const { user, metadata } = ctx;
    const { token, fieldId, fieldValue, authOptions } = ZSignEnvelopeFieldRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    const recipient = await prisma.recipient.findFirst({
      where: {
        token,
      },
    });

    if (!recipient) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    const field = await prisma.field.findFirst({
      where: {
        id: fieldId,
        recipient: {
          ...(recipient.role === RecipientRole.ASSISTANT
            ? {
                signingStatus: {
                  not: SigningStatus.SIGNED,
                },
                signingOrder: {
                  gte: recipient.signingOrder ?? 0,
                },
              }
            : {
                id: recipient.id,
              }),
        },
      },
      include: {
        envelope: {
          include: {
            recipients: true,
            documentMeta: true,
          },
        },
        recipient: true,
      },
    });

    if (!field) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Field ${fieldId} not found`,
      });
    }

    const { envelope } = field;
    const { documentMeta } = envelope;

    if (envelope.internalVersion !== 2) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Envelope ${envelope.id} is not a version 2 envelope`,
      });
    }

    if (
      field.type === FieldType.SIGNATURE &&
      recipient.id !== field.recipientId &&
      recipient.role === RecipientRole.ASSISTANT
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Assistant recipients cannot sign signature fields`,
      });
    }

    if (fieldValue.type !== field.type) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Selected values do not match the field values',
      });
    }

    if (envelope.deletedAt) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Document ${envelope.id} has been deleted`,
      });
    }

    if (envelope.status !== DocumentStatus.PENDING) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Document ${envelope.id} must be pending for signing`,
      });
    }

    if (
      recipient.signingStatus === SigningStatus.SIGNED ||
      field.recipient.signingStatus === SigningStatus.SIGNED
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Recipient ${recipient.id} has already signed`,
      });
    }

    if (field.fieldMeta?.readOnly) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Field ${fieldId} is read only`,
      });
    }

    // Unreachable code based on the above query but we need to satisfy TypeScript
    if (field.recipientId === null) {
      throw new Error(`Field ${fieldId} has no recipientId`);
    }

    const insertionValues = extractFieldInsertionValues({ fieldValue, field, documentMeta });

    // Early return for uninserting fields.
    if (!insertionValues.inserted) {
      return await prisma.$transaction(async (tx) => {
        const updatedField = await tx.field.update({
          where: {
            id: field.id,
          },
          data: {
            customText: '',
            inserted: false,
          },
        });

        await tx.signature.deleteMany({
          where: {
            fieldId: field.id,
          },
        });

        if (recipient.role !== RecipientRole.ASSISTANT) {
          await tx.documentAuditLog.create({
            data: createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED,
              envelopeId: envelope.id,
              user: {
                name: recipient.name,
                email: recipient.email,
              },
              requestMetadata: metadata.requestMetadata,
              data: {
                field: field.type,
                fieldId: field.secondaryId,
              },
            }),
          });
        }

        return {
          signedField: updatedField,
        };
      });
    }

    const derivedRecipientActionAuth = await validateFieldAuth({
      documentAuthOptions: envelope.authOptions,
      recipient,
      field,
      userId: user?.id,
      authOptions,
    });

    const assistant = recipient.role === RecipientRole.ASSISTANT ? recipient : undefined;

    let signatureImageAsBase64 = null;
    let typedSignature = null;

    if (field.type === FieldType.SIGNATURE) {
      if (fieldValue.type !== FieldType.SIGNATURE) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: `Field ${fieldId} is not a signature field`,
        });
      }

      if (fieldValue.value) {
        const isBase64 = isBase64Image(fieldValue.value);

        signatureImageAsBase64 = isBase64 ? fieldValue.value : null;
        typedSignature = !isBase64 ? fieldValue.value : null;
      }
    }

    return await prisma.$transaction(async (tx) => {
      const updatedField = await tx.field.update({
        where: {
          id: field.id,
        },
        data: {
          customText: insertionValues.customText,
          inserted: insertionValues.inserted,
        },
        include: {
          signature: true,
        },
      });

      if (field.type === FieldType.SIGNATURE) {
        const signature = await tx.signature.upsert({
          where: {
            fieldId: field.id,
          },
          create: {
            fieldId: field.id,
            recipientId: field.recipientId,
            signatureImageAsBase64: signatureImageAsBase64,
            typedSignature: typedSignature,
          },
          update: {
            signatureImageAsBase64: signatureImageAsBase64,
            typedSignature: typedSignature,
          },
        });

        // Dirty but I don't want to deal with type information
        Object.assign(updatedField, {
          signature,
        });
      }

      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type:
            assistant && field.recipientId !== assistant.id
              ? DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_PREFILLED
              : DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED,
          envelopeId: envelope.id,
          user: {
            email: assistant?.email ?? recipient.email,
            name: assistant?.name ?? recipient.name,
          },
          requestMetadata: metadata.requestMetadata,
          data: {
            recipientEmail: recipient.email,
            recipientId: recipient.id,
            recipientName: recipient.name,
            recipientRole: recipient.role,
            fieldId: updatedField.secondaryId,
            field: match(updatedField.type)
              .with(FieldType.SIGNATURE, FieldType.FREE_SIGNATURE, (type) => ({
                type,
                data: signatureImageAsBase64 || typedSignature || '',
              }))
              .with(
                FieldType.DATE,
                FieldType.EMAIL,
                FieldType.NAME,
                FieldType.TEXT,
                FieldType.INITIALS,
                (type) => ({
                  type,
                  data: updatedField.customText,
                }),
              )
              .with(
                FieldType.NUMBER,
                FieldType.RADIO,
                FieldType.CHECKBOX,
                FieldType.DROPDOWN,
                (type) => ({
                  type,
                  data: updatedField.customText,
                }),
              )
              .exhaustive(),
            fieldSecurity: derivedRecipientActionAuth
              ? {
                  type: derivedRecipientActionAuth,
                }
              : undefined,
          },
        }),
      });

      return {
        signedField: updatedField,
      };
    });
  },

  'envelope.find': async (ctx: ZapContext, raw) => {
    const { user, teamId } = ctx;

    const {
      query,
      type,
      templateId,
      page,
      perPage,
      orderByDirection,
      orderByColumn,
      source,
      status,
      folderId,
    } = ZFindEnvelopesRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        query,
        type,
        templateId,
        source,
        status,
        folderId,
        page,
        perPage,
      },
    });

    return await findEnvelopes({
      userId: user.id,
      teamId,
      type,
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
  },

  'envelope.auditLog.find': async (ctx: ZapContext, raw) => {
    const {
      envelopeId,
      page = 1,
      perPage = 50,
      orderByColumn = 'createdAt',
      orderByDirection = 'desc',
    } = ZFindEnvelopeAuditLogsRequestSchema.parse(raw);

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
      userId: ctx.user.id,
      teamId: ctx.teamId,
    });

    const envelope = await prisma.envelope.findUnique({
      where: envelopeWhereInput,
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    // Only documents have audit logs.
    if (envelope.type !== EnvelopeType.DOCUMENT) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Templates do not have audit logs.',
      });
    }

    const [data, count] = await Promise.all([
      prisma.documentAuditLog.findMany({
        where: { envelopeId: envelope.id },
        skip: Math.max(page - 1, 0) * perPage,
        take: perPage,
        orderBy: {
          [orderByColumn]: orderByDirection,
        },
      }),
      prisma.documentAuditLog.count({
        where: { envelopeId: envelope.id },
      }),
    ]);

    const parsedData = data.map((auditLog) => parseDocumentAuditLogData(auditLog));

    return {
      data: parsedData,
      count,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: Math.ceil(count / perPage),
    } satisfies FindResultResponse<typeof parsedData>;
  },

  'envelope.bulk.move': async (ctx: ZapContext, raw) => {
    const { teamId, user } = ctx;
    const { envelopeIds, envelopeType, folderId } = ZBulkMoveEnvelopesRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeIds,
        envelopeType,
        folderId,
      },
    });

    // Build the where input for the update query.
    const { envelopeWhereInput, team } = await getMultipleEnvelopeWhereInput({
      ids: {
        type: 'envelopeId',
        ids: envelopeIds,
      },
      userId: user.id,
      teamId,
      type: envelopeType,
    });

    // Validate folder access if moving to a folder (not root).
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: {
          id: folderId,
          team: buildTeamWhereQuery({
            teamId,
            userId: user.id,
          }),
          type: envelopeType,
          visibility: {
            in: TEAM_DOCUMENT_VISIBILITY_MAP[team.currentTeamRole],
          },
        },
      });

      if (!folder) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Folder not found or access denied',
        });
      }
    }

    const result = await prisma.envelope.updateMany({
      where: envelopeWhereInput,
      data: {
        folderId: folderId,
      },
    });

    return {
      movedCount: result.count,
    };
  },

  'envelope.bulk.delete': async (ctx: ZapContext, raw) => {
    const { teamId, user } = ctx;
    const { envelopeIds } = ZBulkDeleteEnvelopesRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeIds,
      },
    });

    const { envelopeWhereInput } = await getMultipleEnvelopeWhereInput({
      ids: {
        type: 'envelopeId',
        ids: envelopeIds,
      },
      userId: user.id,
      teamId,
      type: null,
    });

    const envelopes = await prisma.envelope.findMany({
      where: envelopeWhereInput,
      select: {
        id: true,
        type: true,
      },
    });

    const results = await pMap(
      envelopes,
      async (envelope) => {
        const { id: envelopeId, type: envelopeType } = envelope;

        try {
          if (envelopeType === EnvelopeType.DOCUMENT) {
            await deleteDocument({
              id: {
                type: 'envelopeId',
                id: envelopeId,
              },
              userId: user.id,
              teamId,
              requestMetadata: ctx.metadata,
            });
          } else if (envelopeType === EnvelopeType.TEMPLATE) {
            await deleteTemplate({
              id: {
                type: 'envelopeId',
                id: envelopeId,
              },
              userId: user.id,
              teamId,
            });
          }

          return {
            success: true,
            envelopeId,
          };
        } catch (err) {
          ctx.logger.warn(
            {
              envelopeId,
              error: err,
            },
            'Failed to delete envelope during bulk delete',
          );

          return {
            success: false,
            envelopeId,
          };
        }
      },
      {
        concurrency: 10,
        stopOnError: false,
      },
    );

    const deletedCount = results.filter((r) => r.success).length;
    const failedIds = results.filter((r) => !r.success).map((r) => r.envelopeId);

    // Include envelope IDs that were not attempted (unauthorized/not found)
    const attemptedIds = new Set(envelopes.map((e) => e.id));
    const unattemptedIds = envelopeIds.filter((id) => !attemptedIds.has(id));

    return {
      deletedCount,
      failedIds: [...failedIds, ...unattemptedIds],
    };
  },

  'envelope.editor.get': async (ctx: ZapContext, raw) => {
    const { teamId, user } = ctx;
    const { envelopeId } = ZGetEditorEnvelopeRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    return await getEditorEnvelopeById({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: null,
    });
  },

  'envelope.get': async (ctx: ZapContext, raw) => {
    const { teamId, user } = ctx;
    const { envelopeId } = ZGetEnvelopeRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    return await getEnvelopeById({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: null,
    });
  },

  'envelope.getMany': async (ctx: ZapContext, raw) => {
    const { teamId, user } = ctx;
    const { ids } = ZGetEnvelopesByIdsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        ids,
      },
    });

    const envelopes = await getEnvelopesByIds({
      ids,
      userId: user.id,
      teamId,
      type: null,
    });

    return {
      data: envelopes,
    };
  },

  'envelope.create': async (ctx: ZapContext, raw) => {
    const input = ZCreateEnvelopeRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        folderId: input.payload.folderId,
      },
    });

    return await createEnvelopeRouteCaller({
      userId: ctx.user.id,
      teamId: ctx.teamId,
      input,
      apiRequestMetadata: ctx.metadata,
    });
  },

  'envelope.use': async (ctx: ZapContext, raw) => {
    const { user, teamId } = ctx;

    const { payload, files = [] } = ZUseEnvelopeRequestSchema.parse(raw);

    const {
      envelopeId,
      externalId,
      recipients = [],
      distributeDocument,
      customDocumentData = [],
      folderId,
      prefillFields,
      override,
      attachments,
      formValues,
    } = payload;

    ctx.logger.info({
      input: {
        envelopeId,
        folderId,
      },
    });

    const limits = await getServerLimits({ userId: user.id, teamId });

    if (limits.remaining.documents === 0) {
      throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
        message: 'You have reached your document limit.',
      });
    }

    // Verify the template exists and get envelope items
    const envelope = await getEnvelopeById({
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: EnvelopeType.TEMPLATE,
      userId: user.id,
      teamId,
    });

    if (files.length > envelope.envelopeItems.length) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `You cannot upload more than ${envelope.envelopeItems.length} envelope items per envelope`,
      });
    }

    const filesToUpload = files.filter(
      (file, index) =>
        payload.customDocumentData &&
        payload.customDocumentData.some(
          (mapping) => mapping.identifier === file.name || mapping.identifier === index,
        ),
    );

    // Process uploaded files and create document data for them
    const uploadedFiles = await Promise.all(
      filesToUpload.map(async (file) => {
        // We disable flattening here since `createDocumentFromTemplate` will handle it.
        const { id: documentDataId } = await putNormalizedPdfFileServerSide(file, {
          flattenForm: false,
        });

        return {
          name: file.name,
          documentDataId,
        };
      }),
    );

    // Map custom document data using identifiers
    const customDocumentDataMapped = customDocumentData?.map((mapping) => {
      let documentDataId: string | undefined;

      // Find the uploaded file by identifier
      if (typeof mapping.identifier === 'string') {
        documentDataId = uploadedFiles.find(
          (file) => file.name === mapping.identifier,
        )?.documentDataId;
      }

      if (typeof mapping.identifier === 'number') {
        documentDataId = uploadedFiles.at(mapping.identifier)?.documentDataId;
      }

      if (mapping.identifier === undefined) {
        documentDataId = uploadedFiles.at(0)?.documentDataId;
      }

      if (!documentDataId) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: `File with identifier "${mapping.identifier}" not found in uploaded files`,
        });
      }

      // Verify that the envelopeItemId exists in the template
      const envelopeItem = envelope.envelopeItems.find(
        (item) => item.id === mapping.envelopeItemId,
      );

      if (!envelopeItem) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: `Envelope item with ID "${mapping.envelopeItemId}" not found in template`,
        });
      }

      return {
        documentDataId,
        envelopeItemId: mapping.envelopeItemId,
      };
    });

    // Create document from template
    const createdEnvelope = await createDocumentFromTemplate({
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      externalId,
      teamId,
      userId: user.id,
      recipients,
      customDocumentData: customDocumentDataMapped,
      requestMetadata: ctx.metadata,
      folderId,
      prefillFields,
      override,
      attachments,
      formValues,
    });

    // Distribute document if requested
    if (distributeDocument) {
      await sendDocument({
        id: {
          type: 'envelopeId',
          id: createdEnvelope.id,
        },
        userId: user.id,
        teamId,
        requestMetadata: ctx.metadata,
      }).catch((err) => {
        console.error(err);

        throw new AppError('DOCUMENT_SEND_FAILED');
      });
    }

    return {
      id: createdEnvelope.id,
      recipients: createdEnvelope.recipients.map((recipient) => ({
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        token: recipient.token,
        role: recipient.role,
        signingOrder: recipient.signingOrder,
        signingUrl: formatSigningLink(recipient.token),
      })),
    };
  },

  'envelope.update': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { envelopeId, data, meta = {} } = ZUpdateEnvelopeRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const userId = ctx.user.id;

    return await updateEnvelope({
      userId,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      data,
      meta,
      requestMetadata: ctx.metadata,
    });
  },

  'envelope.delete': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { envelopeId } = ZDeleteEnvelopeRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const unsafeEnvelope = await prisma.envelope.findUnique({
      where: {
        id: envelopeId,
      },
      select: {
        type: true,
      },
    });

    if (!unsafeEnvelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    await match(unsafeEnvelope.type)
      .with(EnvelopeType.DOCUMENT, async () =>
        deleteDocument({
          userId: ctx.user.id,
          teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
          requestMetadata: ctx.metadata,
        }),
      )
      .with(EnvelopeType.TEMPLATE, async () =>
        deleteTemplate({
          userId: ctx.user.id,
          teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
        }),
      )
      .exhaustive();

    return ZGenericSuccessResponse;
  },

  'envelope.duplicate': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { envelopeId } = ZDuplicateEnvelopeRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const duplicatedEnvelope = await duplicateEnvelope({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
    });

    return {
      id: duplicatedEnvelope.id,
    };
  },

  'envelope.distribute': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { envelopeId, meta = {} } = ZDistributeEnvelopeRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    if (Object.values(meta).length > 0) {
      await updateDocumentMeta({
        userId: ctx.user.id,
        teamId,
        id: {
          type: 'envelopeId',
          id: envelopeId,
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
        type: 'envelopeId',
        id: envelopeId,
      },
      teamId,
      requestMetadata: ctx.metadata,
    });

    return {
      success: true,
      id: envelope.id,
      recipients: envelope.recipients.map((recipient) => ({
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        token: recipient.token,
        role: recipient.role,
        signingOrder: recipient.signingOrder,
        signingUrl: formatSigningLink(recipient.token),
      })),
    };
  },

  'envelope.redistribute': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { envelopeId, recipients } = ZRedistributeEnvelopeRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        envelopeId,
        recipients,
      },
    });

    const envelope = await resendDocument({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      recipients,
      requestMetadata: ctx.metadata,
    });

    return {
      success: true,
      id: envelope.id,
      recipients: envelope.recipients.map((recipient) => ({
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        token: recipient.token,
        role: recipient.role,
        signingOrder: recipient.signingOrder,
        signingUrl: formatSigningLink(recipient.token),
      })),
    };
  },

  'envelope.signingStatus': async (ctx: ZapContext, raw) => {
    const { token } = ZSigningStatusEnvelopeRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        token,
      },
    });

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
          select: {
            id: true,
            name: true,
            email: true,
            signingStatus: true,
            role: true,
          },
        },
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    // Check if envelope is rejected
    if (envelope.status === DocumentStatus.REJECTED) {
      return {
        status: 'REJECTED',
      };
    }

    if (envelope.status === DocumentStatus.COMPLETED) {
      return {
        status: 'COMPLETED',
      };
    }

    const isComplete =
      envelope.recipients.some((recipient) => recipient.signingStatus === SigningStatus.REJECTED) ||
      envelope.recipients.every(
        (recipient) =>
          recipient.role === RecipientRole.CC || recipient.signingStatus === SigningStatus.SIGNED,
      );

    if (isComplete) {
      return {
        status: 'PROCESSING',
      };
    }

    return {
      status: 'PENDING',
    };
  },
};
