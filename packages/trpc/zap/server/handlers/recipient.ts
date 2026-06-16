// esign ZAP handlers — recipient router (fully ported, 17/17 procedures).
//
// Verbatim tRPC procedure bodies rewired to (ctx, raw). Input is validated by
// the SAME Zod schemas the tRPC procedures used; the server-only recipient
// functions are reused unchanged. The two token-based signing flows
// (recipient.completeDocumentWithToken / rejectDocumentWithToken) were
// unauthenticated `procedure`s in tRPC and are ported verbatim — they read
// ctx.user?.id and ctx.metadata.requestMetadata exactly as before.
//
// Route keys (dotted, matching the tRPC nested router shape):
//   recipient.suggestions.find
//   recipient.getDocumentRecipient / createDocumentRecipient /
//     createDocumentRecipients / updateDocumentRecipient /
//     updateDocumentRecipients / deleteDocumentRecipient / setDocumentRecipients
//   recipient.getTemplateRecipient / createTemplateRecipient /
//     createTemplateRecipients / updateTemplateRecipient /
//     updateTemplateRecipients / deleteTemplateRecipient / setTemplateRecipients
//   recipient.completeDocumentWithToken / rejectDocumentWithToken
import { EnvelopeType } from '@prisma/client';

import { completeDocumentWithToken } from '@hanzo/sign-lib/server-only/document/complete-document-with-token';
import { rejectDocumentWithToken } from '@hanzo/sign-lib/server-only/document/reject-document-with-token';
import { createEnvelopeRecipients } from '@hanzo/sign-lib/server-only/recipient/create-envelope-recipients';
import { deleteEnvelopeRecipient } from '@hanzo/sign-lib/server-only/recipient/delete-envelope-recipient';
import { getRecipientById } from '@hanzo/sign-lib/server-only/recipient/get-recipient-by-id';
import { getRecipientSuggestions } from '@hanzo/sign-lib/server-only/recipient/get-recipient-suggestions';
import { setDocumentRecipients } from '@hanzo/sign-lib/server-only/recipient/set-document-recipients';
import { setTemplateRecipients } from '@hanzo/sign-lib/server-only/recipient/set-template-recipients';
import { updateEnvelopeRecipients } from '@hanzo/sign-lib/server-only/recipient/update-envelope-recipients';

import { ZGetRecipientSuggestionsRequestSchema } from '../../../server/recipient-router/find-recipient-suggestions.types';
import {
  ZCompleteDocumentWithTokenMutationSchema,
  ZCreateDocumentRecipientRequestSchema,
  ZCreateDocumentRecipientsRequestSchema,
  ZCreateTemplateRecipientRequestSchema,
  ZCreateTemplateRecipientsRequestSchema,
  ZDeleteDocumentRecipientRequestSchema,
  ZDeleteTemplateRecipientRequestSchema,
  ZGetRecipientRequestSchema,
  ZRejectDocumentWithTokenMutationSchema,
  ZSetDocumentRecipientsRequestSchema,
  ZSetTemplateRecipientsRequestSchema,
  ZUpdateDocumentRecipientRequestSchema,
  ZUpdateDocumentRecipientsRequestSchema,
  ZUpdateTemplateRecipientRequestSchema,
  ZUpdateTemplateRecipientsRequestSchema,
} from '../../../server/recipient-router/schema';
import { ZGenericSuccessResponse } from '../../../server/schema';
import type { ZapContext } from '../context';
import type { ZapRouteMap } from '../dispatch';

export const recipientRoutes: ZapRouteMap = {
  'recipient.suggestions.find': async (ctx: ZapContext, raw) => {
    const { teamId, user } = ctx;
    const { query } = ZGetRecipientSuggestionsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        query,
      },
    });

    const suggestions = await getRecipientSuggestions({
      userId: user.id,
      teamId,
      query,
    });

    return {
      results: suggestions,
    };
  },

  'recipient.getDocumentRecipient': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { recipientId } = ZGetRecipientRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        recipientId,
      },
    });

    return await getRecipientById({
      userId: ctx.user.id,
      teamId,
      recipientId,
      type: EnvelopeType.DOCUMENT,
    });
  },

  'recipient.createDocumentRecipient': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { documentId, recipient } = ZCreateDocumentRecipientRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const createdRecipients = await createEnvelopeRecipients({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
      recipients: [recipient],
      requestMetadata: ctx.metadata,
    });

    return createdRecipients.recipients[0];
  },

  'recipient.createDocumentRecipients': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { documentId, recipients } = ZCreateDocumentRecipientsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    return await createEnvelopeRecipients({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
      recipients,
      requestMetadata: ctx.metadata,
    });
  },

  'recipient.updateDocumentRecipient': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { documentId, recipient } = ZUpdateDocumentRecipientRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const updatedRecipients = await updateEnvelopeRecipients({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
      recipients: [recipient],
      requestMetadata: ctx.metadata,
    });

    return updatedRecipients.recipients[0];
  },

  'recipient.updateDocumentRecipients': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { documentId, recipients } = ZUpdateDocumentRecipientsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    return await updateEnvelopeRecipients({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
      recipients,
      requestMetadata: ctx.metadata,
    });
  },

  'recipient.deleteDocumentRecipient': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { recipientId } = ZDeleteDocumentRecipientRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        recipientId,
      },
    });

    await deleteEnvelopeRecipient({
      userId: ctx.user.id,
      teamId,
      recipientId,
      requestMetadata: ctx.metadata,
    });

    return ZGenericSuccessResponse;
  },

  'recipient.setDocumentRecipients': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { documentId, recipients } = ZSetDocumentRecipientsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    return await setDocumentRecipients({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
      recipients: recipients.map((recipient) => ({
        id: recipient.id,
        email: recipient.email,
        name: recipient.name,
        role: recipient.role,
        signingOrder: recipient.signingOrder,
        actionAuth: recipient.actionAuth,
      })),
      requestMetadata: ctx.metadata,
    });
  },

  'recipient.getTemplateRecipient': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { recipientId } = ZGetRecipientRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        recipientId,
      },
    });

    return await getRecipientById({
      userId: ctx.user.id,
      teamId,
      recipientId,
      type: EnvelopeType.TEMPLATE,
    });
  },

  'recipient.createTemplateRecipient': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { templateId, recipient } = ZCreateTemplateRecipientRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    const createdRecipients = await createEnvelopeRecipients({
      userId: ctx.user.id,
      teamId,
      id: {
        id: templateId,
        type: 'templateId',
      },
      recipients: [recipient],
      requestMetadata: ctx.metadata,
    });

    return createdRecipients.recipients[0];
  },

  'recipient.createTemplateRecipients': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { templateId, recipients } = ZCreateTemplateRecipientsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    return await createEnvelopeRecipients({
      userId: ctx.user.id,
      teamId,
      id: {
        id: templateId,
        type: 'templateId',
      },
      recipients,
      requestMetadata: ctx.metadata,
    });
  },

  'recipient.updateTemplateRecipient': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { templateId, recipient } = ZUpdateTemplateRecipientRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    const updatedRecipients = await updateEnvelopeRecipients({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'templateId',
        id: templateId,
      },
      recipients: [recipient],
      requestMetadata: ctx.metadata,
    });

    return updatedRecipients.recipients[0];
  },

  'recipient.updateTemplateRecipients': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { templateId, recipients } = ZUpdateTemplateRecipientsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    return await updateEnvelopeRecipients({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'templateId',
        id: templateId,
      },
      recipients,
      requestMetadata: ctx.metadata,
    });
  },

  'recipient.deleteTemplateRecipient': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { recipientId } = ZDeleteTemplateRecipientRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        recipientId,
      },
    });

    await deleteEnvelopeRecipient({
      recipientId,
      userId: ctx.user.id,
      teamId,
      requestMetadata: ctx.metadata,
    });

    return ZGenericSuccessResponse;
  },

  'recipient.setTemplateRecipients': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { templateId, recipients } = ZSetTemplateRecipientsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    return await setTemplateRecipients({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'templateId',
        id: templateId,
      },
      recipients: recipients.map((recipient) => ({
        id: recipient.id,
        email: recipient.email,
        name: recipient.name,
        role: recipient.role,
        signingOrder: recipient.signingOrder,
        actionAuth: recipient.actionAuth,
      })),
    });
  },

  'recipient.completeDocumentWithToken': async (ctx: ZapContext, raw) => {
    const { token, documentId, accessAuthOptions, nextSigner, recipientOverride } =
      ZCompleteDocumentWithTokenMutationSchema.parse(raw);

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    await completeDocumentWithToken({
      token,
      id: {
        type: 'documentId',
        id: documentId,
      },
      accessAuthOptions,
      nextSigner,
      recipientOverride,
      userId: ctx.user?.id,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  },

  'recipient.rejectDocumentWithToken': async (ctx: ZapContext, raw) => {
    const { token, documentId, reason } = ZRejectDocumentWithTokenMutationSchema.parse(raw);

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    return await rejectDocumentWithToken({
      token,
      id: {
        type: 'documentId',
        id: documentId,
      },
      reason,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  },
};
