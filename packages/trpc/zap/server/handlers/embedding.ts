// esign ZAP handlers — embedding-presign router (fully ported, 9/9 procedures).
//
// Verbatim tRPC procedure bodies rewired to (ctx, raw). Input is validated by
// the SAME Zod request schema the tRPC procedure used; the server-only
// functions are reused unchanged. Route keys mirror the tRPC nested router
// shape — the embedding router is wired under the `embeddingPresign` key in the
// main appRouter, so every route key is "embeddingPresign.<procedure>".
//
// AUTH SEMANTICS — the one non-mechanical part of this port:
//
// The tRPC embedding procedures did NOT use the authenticatedMiddleware. They
// read a credential straight off the request: `req.headers.get('authorization')`
// → "[Bearer] <token>". Two distinct credential classes ride that header:
//
//   * createEmbeddingPresignToken — Bearer is a regular API token. The body
//     needs the RAW token STRING (it is HMAC'd into the minted presign token),
//     so the literal bytes are load-bearing.
//   * createEmbeddingEnvelope / Document / Template and the update* routes —
//     Bearer is a PRESIGN token (a signed JWT), verified by
//     verifyEmbeddingPresignToken, NOT by getApiTokenByToken.
//
// The ZAP MintCap (mint.ts) authenticates ONCE at the WS upgrade via
// getApiTokenByToken / session cookie and discards the raw header. It cannot:
//   (a) preserve the raw API-token string createEmbeddingPresignToken needs, nor
//   (b) mint a context for a presign-token credential (getApiTokenByToken does
//       not recognise a presign JWT → the upgrade would be rejected with 401).
//
// So the credential travels in the request PAYLOAD under ZAP, exactly as the
// task spec directs ("derive the value from input where possible"). The ZAP
// client appends the token to the superjson body; each handler pulls it with a
// local `.and(z.object({ presignToken | apiToken: z.string() }))` so the
// ORIGINAL exported request schema and its inferred types stay untouched. The
// verification + authorization logic (verifyEmbeddingPresignToken /
// getApiTokenByToken + organisation-claim checks) is preserved BYTE-FOR-BYTE;
// only the line that SOURCED the token (header → input) changes. verify and
// getMultiSignDocument are public (token-in-body already) and need no shim.
import { DocumentStatus, EnvelopeType } from '@prisma/client';
import pMap from 'p-map';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { IS_BILLING_ENABLED } from '@hanzo/esign-lib/constants/app';
import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { getDocumentAndSenderByToken } from '@hanzo/esign-lib/server-only/document/get-document-by-token';
import { viewedDocument } from '@hanzo/esign-lib/server-only/document/viewed-document';
import { createEmbeddingPresignToken } from '@hanzo/esign-lib/server-only/embedding-presign/create-embedding-presign-token';
import { verifyEmbeddingPresignToken } from '@hanzo/esign-lib/server-only/embedding-presign/verify-embedding-presign-token';
import { UNSAFE_createEnvelopeItems } from '@hanzo/esign-lib/server-only/envelope-item/create-envelope-items';
import { UNSAFE_deleteEnvelopeItem } from '@hanzo/esign-lib/server-only/envelope-item/delete-envelope-item';
import { UNSAFE_updateEnvelopeItems } from '@hanzo/esign-lib/server-only/envelope-item/update-envelope-items';
import { createEnvelope } from '@hanzo/esign-lib/server-only/envelope/create-envelope';
import { getEnvelopeWhereInput } from '@hanzo/esign-lib/server-only/envelope/get-envelope-by-id';
import { updateEnvelope } from '@hanzo/esign-lib/server-only/envelope/update-envelope';
import { getCompletedFieldsForToken } from '@hanzo/esign-lib/server-only/field/get-completed-fields-for-token';
import { getFieldsForToken } from '@hanzo/esign-lib/server-only/field/get-fields-for-token';
import { setFieldsForDocument } from '@hanzo/esign-lib/server-only/field/set-fields-for-document';
import { setFieldsForTemplate } from '@hanzo/esign-lib/server-only/field/set-fields-for-template';
import { getOrganisationClaimByTeamId } from '@hanzo/esign-lib/server-only/organisation/get-organisation-claims';
import { getApiTokenByToken } from '@hanzo/esign-lib/server-only/public-api/get-api-token-by-token';
import { getRecipientByToken } from '@hanzo/esign-lib/server-only/recipient/get-recipient-by-token';
import { setDocumentRecipients } from '@hanzo/esign-lib/server-only/recipient/set-document-recipients';
import { setTemplateRecipients } from '@hanzo/esign-lib/server-only/recipient/set-template-recipients';
import { nanoid } from '@hanzo/esign-lib/universal/id';
import { PRESIGNED_ENVELOPE_ITEM_ID_PREFIX } from '@hanzo/esign-lib/utils/embed-config';
import {
  canEnvelopeItemsBeModified,
  mapSecondaryIdToDocumentId,
  mapSecondaryIdToTemplateId,
} from '@hanzo/esign-lib/utils/envelope';
import { prisma } from '@hanzo/esign-prisma';

import { ZCreateEmbeddingDocumentRequestSchema } from '../../../server/embedding-router/create-embedding-document.types';
import { ZCreateEmbeddingEnvelopeRequestSchema } from '../../../server/embedding-router/create-embedding-envelope.types';
import { ZCreateEmbeddingPresignTokenRequestSchema } from '../../../server/embedding-router/create-embedding-presign-token.types';
import { ZCreateEmbeddingTemplateRequestSchema } from '../../../server/embedding-router/create-embedding-template.types';
import { ZGetMultiSignDocumentRequestSchema } from '../../../server/embedding-router/get-multi-sign-document.types';
import { ZUpdateEmbeddingDocumentRequestSchema } from '../../../server/embedding-router/update-embedding-document.types';
import { ZUpdateEmbeddingEnvelopeRequestSchema } from '../../../server/embedding-router/update-embedding-envelope.types';
import { ZUpdateEmbeddingTemplateRequestSchema } from '../../../server/embedding-router/update-embedding-template.types';
import { ZVerifyEmbeddingPresignTokenRequestSchema } from '../../../server/embedding-router/verify-embedding-presign-token.types';
import { createEnvelopeRouteCaller } from '../../../server/envelope-router/create-envelope';
import type { ZapContext } from '../context';
import type { ZapRouteMap } from '../dispatch';

// The token the tRPC handler read from `Authorization: [Bearer] <token>`. Under
// ZAP it rides the request body — added by the ZAP client, validated here, and
// stripped before the original input is consumed. The original exported request
// schemas are left untouched; these `.and(...)` extensions exist only at the
// transport boundary.
const ZBearer = z.object({ presignToken: z.string().min(1) });

export const embeddingRoutes: ZapRouteMap = {
  'embeddingPresign.createEmbeddingPresignToken': async (ctx: ZapContext, raw) => {
    const { apiToken, ...rest } = ZCreateEmbeddingPresignTokenRequestSchema.and(
      z.object({ apiToken: z.string().min(1) }),
    ).parse(raw);
    const input = ZCreateEmbeddingPresignTokenRequestSchema.parse(rest);

    try {
      if (!apiToken) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'No API token provided',
        });
      }

      const { expiresIn, scope } = input;

      if (IS_BILLING_ENABLED()) {
        const token = await getApiTokenByToken({ token: apiToken });

        if (!token.userId) {
          throw new AppError(AppErrorCode.UNAUTHORIZED, {
            message: 'Invalid API token',
          });
        }

        const organisationClaim = await getOrganisationClaimByTeamId({
          teamId: token.teamId,
        });

        if (!organisationClaim.flags.embedAuthoring) {
          throw new AppError(AppErrorCode.UNAUTHORIZED, {
            message: 'You do not have permission to create embedding presign tokens',
          });
        }
      }

      const presignToken = await createEmbeddingPresignToken({
        apiToken,
        expiresIn,
        scope,
      });

      return { ...presignToken };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to create embedding presign token',
      });
    }
  },

  'embeddingPresign.verifyEmbeddingPresignToken': async (_ctx: ZapContext, raw) => {
    const input = ZVerifyEmbeddingPresignTokenRequestSchema.parse(raw);

    try {
      const { token, scope } = input;

      const apiToken = await verifyEmbeddingPresignToken({
        token,
        scope,
      }).catch(() => null);

      return { success: !!apiToken };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to verify embedding presign token',
      });
    }
  },

  'embeddingPresign.createEmbeddingEnvelope': async (ctx: ZapContext, raw) => {
    const { presignToken, ...rest } = ZCreateEmbeddingEnvelopeRequestSchema.and(ZBearer).parse(raw);
    const input = ZCreateEmbeddingEnvelopeRequestSchema.parse(rest);

    if (!presignToken) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'No presign token provided',
      });
    }

    const apiToken = await verifyEmbeddingPresignToken({ token: presignToken });

    const { userId, teamId } = apiToken;

    return await createEnvelopeRouteCaller({
      userId,
      teamId,
      input,
      options: {
        // Default recipients should be added on the frontend automatically for embeds.
        bypassDefaultRecipients: true,
      },
      apiRequestMetadata: ctx.metadata,
    });
  },

  'embeddingPresign.createEmbeddingDocument': async (ctx: ZapContext, raw) => {
    const { metadata } = ctx;
    const { presignToken, ...rest } = ZCreateEmbeddingDocumentRequestSchema.and(ZBearer).parse(raw);
    const input = ZCreateEmbeddingDocumentRequestSchema.parse(rest);

    try {
      if (!presignToken) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'No presign token provided',
        });
      }

      const apiToken = await verifyEmbeddingPresignToken({ token: presignToken });

      const { title, documentDataId, externalId, recipients, meta } = input;

      const envelope = await createEnvelope({
        internalVersion: 1,
        data: {
          type: EnvelopeType.DOCUMENT,
          title,
          externalId,
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
          envelopeItems: [
            {
              documentDataId,
            },
          ],
        },
        meta,
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        requestMetadata: metadata,
      });

      if (!envelope.id) {
        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Failed to create document: missing document ID',
        });
      }

      const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

      return {
        documentId: legacyDocumentId,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to create document',
      });
    }
  },

  'embeddingPresign.createEmbeddingTemplate': async (ctx: ZapContext, raw) => {
    const { metadata } = ctx;
    const { presignToken, ...rest } = ZCreateEmbeddingTemplateRequestSchema.and(ZBearer).parse(raw);
    const input = ZCreateEmbeddingTemplateRequestSchema.parse(rest);

    try {
      if (!presignToken) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'No presign token provided',
        });
      }

      const apiToken = await verifyEmbeddingPresignToken({ token: presignToken });

      const { title, documentDataId, recipients, meta } = input;

      // First create the template
      const template = await createEnvelope({
        internalVersion: 1,
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        data: {
          type: EnvelopeType.TEMPLATE,
          title,
          envelopeItems: [
            {
              documentDataId,
            },
          ],
        },
        meta,
        requestMetadata: metadata,
      });

      const firstEnvelopeItem = template.envelopeItems[0];

      await Promise.all(
        recipients.map(async (recipient) => {
          const createdRecipient = await prisma.recipient.create({
            data: {
              envelopeId: template.id,
              email: recipient.email,
              name: recipient.name || '',
              role: recipient.role || 'SIGNER',
              token: `template-${template.id}-${recipient.email}`,
              signingOrder: recipient.signingOrder,
            },
          });

          const fields = recipient.fields ?? [];

          const createdFields = await prisma.field.createMany({
            data: fields.map((field) => ({
              envelopeId: template.id,
              envelopeItemId: firstEnvelopeItem.id,
              recipientId: createdRecipient.id,
              type: field.type,
              page: field.pageNumber,
              positionX: field.pageX,
              positionY: field.pageY,
              width: field.width,
              height: field.height,
              customText: '',
              inserted: false,
            })),
          });

          return {
            ...createdRecipient,
            fields: createdFields,
          };
        }),
      );

      if (!template.id) {
        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Failed to create template: missing template ID',
        });
      }

      return {
        templateId: mapSecondaryIdToTemplateId(template.secondaryId),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to create template',
      });
    }
  },

  'embeddingPresign.updateEmbeddingEnvelope': async (ctx: ZapContext, raw) => {
    const { presignToken, ...rest } = ZUpdateEmbeddingEnvelopeRequestSchema.and(ZBearer).parse(raw);
    const input = ZUpdateEmbeddingEnvelopeRequestSchema.parse(rest);

    const { payload, files } = input;
    const { envelopeId, data, meta } = payload;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    if (!presignToken) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'No presign token provided',
      });
    }

    const apiToken = await verifyEmbeddingPresignToken({
      token: presignToken,
      scope: `envelopeId:${envelopeId}`,
    });

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: null, // Allow updating both documents and templates.
      userId: apiToken.userId,
      teamId: apiToken.teamId,
    });

    const envelope = await prisma.envelope.findFirst({
      where: envelopeWhereInput,
      include: {
        envelopeItems: true,
        team: {
          select: {
            organisation: {
              select: {
                organisationClaim: true,
              },
            },
          },
        },
        recipients: true,
        envelopeAttachments: true,
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    if (envelope.status === DocumentStatus.COMPLETED) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Cannot modify completed envelope',
      });
    }

    // Step 1: Update the envelope items.
    const envelopeItemsToUpdate: EnvelopeItemUpdateOptions[] = [];
    const envelopeItemsToCreate: EnvelopeItemCreateOptions[] = [];

    // Sort and group envelope items to update and create.
    data.envelopeItems.forEach((item) => {
      const isNewEnvelopeItem = item.id.startsWith(PRESIGNED_ENVELOPE_ITEM_ID_PREFIX);

      // Handle existing envelope items.
      if (!isNewEnvelopeItem) {
        const envelopeItem = envelope.envelopeItems.find(
          (envelopeItem) => envelopeItem.id === item.id,
        );

        if (!envelopeItem) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
            message: 'Envelope item not found',
          });
        }

        const hasEnvelopeItemChanged =
          envelopeItem.title !== item.title || envelopeItem.order !== item.order;

        if (hasEnvelopeItemChanged) {
          envelopeItemsToUpdate.push({
            envelopeItemId: envelopeItem.id,
            title: item.title,
            order: item.order,
          });
        }

        // Return to continue loop.
        return;
      }

      const newEnvelopeItemFile = item.index !== undefined ? files[item.index] : undefined;

      if (!newEnvelopeItemFile) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid envelope item index',
        });
      }

      // Handle not yet uploaded envelope items.
      envelopeItemsToCreate.push({
        embeddedEnvelopeItemId: item.id,
        title: item.title,
        order: item.order,
        file: newEnvelopeItemFile,
      });
    });

    // Delete envelope items that have been removed from the payload.
    const envelopeItemIdsToDelete = envelope.envelopeItems
      .filter((item) => !data.envelopeItems.some((i) => i.id === item.id))
      .map((item) => item.id);

    const willEnvelopeItemsBeModified =
      envelopeItemIdsToDelete.length > 0 ||
      envelopeItemsToCreate.length > 0 ||
      envelopeItemsToUpdate.length > 0;

    const organisationClaim = envelope.team.organisation.organisationClaim;
    const resultingEnvelopeItemCount =
      envelope.envelopeItems.length - envelopeItemIdsToDelete.length + envelopeItemsToCreate.length;

    if (resultingEnvelopeItemCount > organisationClaim.envelopeItemCount) {
      throw new AppError('ENVELOPE_ITEM_LIMIT_EXCEEDED', {
        message: `You cannot upload more than ${organisationClaim.envelopeItemCount} envelope items`,
        statusCode: 400,
      });
    }

    // Should be safe to use stale envelope.recipients since only signed or sent
    // recipients affect the outcome.
    if (willEnvelopeItemsBeModified && !canEnvelopeItemsBeModified(envelope, envelope.recipients)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope item is not editable',
      });
    }

    if (envelopeItemIdsToDelete.length > 0) {
      await pMap(
        envelopeItemIdsToDelete,
        async (envelopeItemId) => {
          await UNSAFE_deleteEnvelopeItem({
            envelopeId: envelope.id,
            envelopeItemId,
            user: apiToken.user,
            apiRequestMetadata: ctx.metadata,
          });
        },
        { concurrency: 2 },
      );
    }

    // Mapping for the client side embedded prefix envelope item IDs to the real envelope item IDs.
    const embeddedEnvelopeItemIdMapping: Record<string, string> = {};

    // Create new envelope items.
    if (envelopeItemsToCreate.length > 0) {
      const createdEnvelopeItems = await UNSAFE_createEnvelopeItems({
        files: envelopeItemsToCreate.map((item) => ({
          clientId: item.embeddedEnvelopeItemId,
          file: item.file,
          orderOverride: item.order,
        })),
        envelope: {
          ...envelope,
          // Purposefully putting empty recipients here since placeholders should automatically injected on the client side for
          // embedded purposes. Todo: Embeds - (Not implemeneted yet)
          recipients: [],
        },
        user: {
          id: apiToken.user.id,
          name: apiToken.user.name,
          email: apiToken.user.email,
        },
        apiRequestMetadata: ctx.metadata,
      });

      // Build the map from the envelope item order.
      createdEnvelopeItems.forEach((item) => {
        if (!item.clientId) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
            message: 'Client ID not found',
          });
        }

        embeddedEnvelopeItemIdMapping[item.clientId] = item.id;
      });
    }

    if (envelopeItemsToUpdate.length > 0) {
      await UNSAFE_updateEnvelopeItems({
        envelopeId: envelope.id,
        data: envelopeItemsToUpdate,
      });
    }

    // Step 2: Update the general envelope data and meta.
    await updateEnvelope({
      userId: apiToken.userId,
      teamId: apiToken.teamId,
      id: {
        type: 'envelopeId',
        id: envelope.id,
      },
      data: {
        title: data.title,
        externalId: data.externalId,
        visibility: data.visibility,
        globalAccessAuth: data.globalAccessAuth,
        globalActionAuth: data.globalActionAuth,
        folderId: data.folderId,
      },
      meta,
      requestMetadata: ctx.metadata,
    });

    // Step 3: Update the recipients
    const recipientsWithClientId = data.recipients.map((recipient) => ({
      ...recipient,
      clientId: nanoid(),
    }));

    const { recipients: updatedRecipients } = await match(envelope.type)
      .with(EnvelopeType.DOCUMENT, async () =>
        setDocumentRecipients({
          userId: apiToken.userId,
          teamId: apiToken.teamId,
          id: {
            type: 'envelopeId',
            id: envelope.id,
          },
          recipients: recipientsWithClientId.map((recipient) => ({
            id: recipient.id,
            clientId: recipient.clientId,
            email: recipient.email,
            name: recipient.name ?? '',
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            actionAuth: recipient.actionAuth,
          })),
          requestMetadata: ctx.metadata,
        }),
      )
      .with(EnvelopeType.TEMPLATE, async () =>
        setTemplateRecipients({
          userId: apiToken.userId,
          teamId: apiToken.teamId,
          id: {
            type: 'envelopeId',
            id: envelope.id,
          },
          recipients: recipientsWithClientId.map((recipient) => ({
            id: recipient.id,
            clientId: recipient.clientId,
            email: recipient.email,
            name: recipient.name ?? '',
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            actionAuth: recipient.actionAuth,
          })),
        }),
      )
      .exhaustive();

    // Step 4: Update the fields.
    const fields = recipientsWithClientId.flatMap((recipient) => {
      const recipientId = updatedRecipients.find((r) => r.clientId === recipient.clientId)?.id;

      if (!recipientId) {
        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Recipient not found',
        });
      }

      return (recipient.fields ?? []).map((field) => {
        let envelopeItemId = field.envelopeItemId;

        if (envelopeItemId.startsWith(PRESIGNED_ENVELOPE_ITEM_ID_PREFIX)) {
          envelopeItemId = embeddedEnvelopeItemIdMapping[envelopeItemId];
        }

        if (!envelopeItemId) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
            message: 'Envelope item not found',
          });
        }

        return {
          ...field,
          recipientId,
          envelopeItemId,
        };
      });
    });

    await match(envelope.type)
      .with(EnvelopeType.DOCUMENT, async () =>
        setFieldsForDocument({
          userId: apiToken.userId,
          teamId: apiToken.teamId,
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
          userId: apiToken.userId,
          teamId: apiToken.teamId,
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

    // Step 5: Handle attachments (set semantics: delete all existing, create new).
    let hasEnvelopeAttachmentsChanged =
      envelope.envelopeAttachments.length !== data.attachments.length;

    data.attachments.forEach((attachment) => {
      const foundAttachment = envelope.envelopeAttachments.find((a) => a.id === attachment.id);

      if (!foundAttachment) {
        hasEnvelopeAttachmentsChanged = true;
        return;
      }

      const hasAttachmentChanged =
        foundAttachment.label !== attachment.label ||
        foundAttachment.data !== attachment.data ||
        foundAttachment.type !== attachment.type;

      if (hasAttachmentChanged) {
        hasEnvelopeAttachmentsChanged = true;
        return;
      }
    });

    if (hasEnvelopeAttachmentsChanged) {
      await prisma.envelopeAttachment.deleteMany({
        where: {
          envelopeId: envelope.id,
        },
      });

      if (data.attachments.length > 0) {
        await prisma.envelopeAttachment.createMany({
          data: data.attachments.map((attachment) => ({
            envelopeId: envelope.id,
            label: attachment.label,
            data: attachment.data,
            type: attachment.type,
          })),
        });
      }
    }
  },

  'embeddingPresign.updateEmbeddingDocument': async (ctx: ZapContext, raw) => {
    const { presignToken, ...rest } = ZUpdateEmbeddingDocumentRequestSchema.and(ZBearer).parse(raw);
    const input = ZUpdateEmbeddingDocumentRequestSchema.parse(rest);

    ctx.logger.info({
      input: {
        documentId: input.documentId,
      },
    });

    try {
      if (!presignToken) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'No presign token provided',
        });
      }

      const apiToken = await verifyEmbeddingPresignToken({
        token: presignToken,
        scope: `documentId:${input.documentId}`,
      });

      const { documentId, title, externalId, recipients, meta } = input;

      await updateEnvelope({
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        id: {
          type: 'documentId',
          id: documentId,
        },
        data: {
          title,
          externalId,
        },
        meta,
        requestMetadata: ctx.metadata,
      });

      const recipientsWithClientId = recipients.map((recipient) => ({
        ...recipient,
        clientId: nanoid(),
      }));

      const { recipients: updatedRecipients } = await setDocumentRecipients({
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        id: {
          type: 'documentId',
          id: documentId,
        },
        recipients: recipientsWithClientId.map((recipient) => ({
          id: recipient.id,
          clientId: recipient.clientId,
          email: recipient.email,
          name: recipient.name ?? '',
          role: recipient.role,
          signingOrder: recipient.signingOrder,
        })),
        requestMetadata: ctx.metadata,
      });

      const fields = recipientsWithClientId.flatMap((recipient) => {
        const recipientId = updatedRecipients.find((r) => r.clientId === recipient.clientId)?.id;

        if (!recipientId) {
          throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
            message: 'Recipient not found',
          });
        }

        return (recipient.fields ?? []).map((field) => ({
          ...field,
          recipientId,
          // !: Temp property to be removed once we don't link based on signer email
          signerEmail: recipient.email,
        }));
      });

      await setFieldsForDocument({
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        id: {
          type: 'documentId',
          id: documentId,
        },
        fields: fields.map((field) => ({
          ...field,
          pageWidth: field.width,
          pageHeight: field.height,
        })),
        requestMetadata: ctx.metadata,
      });

      return {
        documentId,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to update document',
      });
    }
  },

  'embeddingPresign.updateEmbeddingTemplate': async (ctx: ZapContext, raw) => {
    const { presignToken, ...rest } = ZUpdateEmbeddingTemplateRequestSchema.and(ZBearer).parse(raw);
    const input = ZUpdateEmbeddingTemplateRequestSchema.parse(rest);

    ctx.logger.info({
      input: {
        templateId: input.templateId,
      },
    });

    try {
      if (!presignToken) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'No presign token provided',
        });
      }

      const apiToken = await verifyEmbeddingPresignToken({
        token: presignToken,
        scope: `templateId:${input.templateId}`,
      });

      const { templateId, title, externalId, recipients, meta } = input;

      await updateEnvelope({
        id: {
          type: 'templateId',
          id: templateId,
        },
        userId: apiToken.userId,
        teamId: apiToken.teamId,
        data: {
          title,
          externalId,
        },
        meta,
        requestMetadata: ctx.metadata,
      });

      const { recipients: updatedRecipients } = await setTemplateRecipients({
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        id: {
          type: 'templateId',
          id: templateId,
        },
        recipients: recipients.map((recipient) => ({
          id: recipient.id,
          email: recipient.email,
          name: recipient.name ?? '',
          role: recipient.role ?? 'SIGNER',
          signingOrder: recipient.signingOrder,
        })),
      });

      const fields = recipients.flatMap((recipient) => {
        const recipientId = updatedRecipients.find((r) => r.id === recipient.id)?.id;

        if (!recipientId) {
          throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
            message: 'Recipient not found',
          });
        }

        return (recipient.fields ?? []).map((field) => ({
          ...field,
          recipientId,
        }));
      });

      await setFieldsForTemplate({
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        id: {
          type: 'templateId',
          id: templateId,
        },
        fields: fields.map((field) => ({
          ...field,
          pageWidth: field.width,
          pageHeight: field.height,
        })),
      });

      return {
        templateId,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to update template',
      });
    }
  },

  'embeddingPresign.getMultiSignDocument': async (ctx: ZapContext, raw) => {
    const { metadata } = ctx;
    const input = ZGetMultiSignDocumentRequestSchema.parse(raw);

    try {
      const { token } = input;

      const [document, fields, recipient] = await Promise.all([
        getDocumentAndSenderByToken({
          token,
          requireAccessAuth: false,
        }).catch(() => null),
        getFieldsForToken({ token }),
        getRecipientByToken({ token }).catch(() => null),
        getCompletedFieldsForToken({ token }).catch(() => []),
      ]);

      if (!document || !recipient) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Document or recipient not found',
        });
      }

      await viewedDocument({
        token,
        requestMetadata: metadata.requestMetadata,
      });

      // Transform fields to match our schema
      const transformedFields = fields.map((field) => ({
        ...field,
        recipient: {
          ...recipient,
          documentId: document.id,
          templateId: null,
        },
        documentId: document.id,
        templateId: null,
      }));

      return {
        ...document,
        folder: null,
        fields: transformedFields,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to get document details',
      });
    }
  },
};

type EnvelopeItemUpdateOptions = {
  envelopeItemId: string;
  title?: string;
  order?: number;
};

type EnvelopeItemCreateOptions = {
  embeddedEnvelopeItemId: string;
  title: string;
  order: number;
  file: File;
};
