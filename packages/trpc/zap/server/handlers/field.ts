// esign ZAP handlers — field router (16/16 procedures).
//
// Verbatim tRPC procedure bodies rewired to (ctx, raw). Input is validated by
// the SAME Zod schema the tRPC procedure used; the server-only field functions
// are reused unchanged. The field router defines its procedures INLINE (not
// one-file-per-procedure), so each mutation/query body is ported verbatim here.
// Two procedures (signFieldWithToken / removeSignedFieldWithToken) used the
// UNauthenticated `procedure` and read ctx.user with optional chaining — that
// is preserved (ctx.user?.id). Route keys are flat ("field.<proc>") mirroring
// the tRPC router shape (see field-router.zap).
import { EnvelopeType } from '@prisma/client';

import { createEnvelopeFields } from '@hanzo/sign-lib/server-only/field/create-envelope-fields';
import { deleteDocumentField } from '@hanzo/sign-lib/server-only/field/delete-document-field';
import { deleteTemplateField } from '@hanzo/sign-lib/server-only/field/delete-template-field';
import { getFieldById } from '@hanzo/sign-lib/server-only/field/get-field-by-id';
import { removeSignedFieldWithToken } from '@hanzo/sign-lib/server-only/field/remove-signed-field-with-token';
import { setFieldsForDocument } from '@hanzo/sign-lib/server-only/field/set-fields-for-document';
import { setFieldsForTemplate } from '@hanzo/sign-lib/server-only/field/set-fields-for-template';
import { signFieldWithToken } from '@hanzo/sign-lib/server-only/field/sign-field-with-token';
import { updateEnvelopeFields } from '@hanzo/sign-lib/server-only/field/update-envelope-fields';

import {
  ZCreateDocumentFieldRequestSchema,
  ZCreateDocumentFieldsRequestSchema,
  ZCreateTemplateFieldRequestSchema,
  ZCreateTemplateFieldsRequestSchema,
  ZDeleteDocumentFieldRequestSchema,
  ZDeleteTemplateFieldRequestSchema,
  ZGetFieldRequestSchema,
  ZRemovedSignedFieldWithTokenMutationSchema,
  ZSetDocumentFieldsRequestSchema,
  ZSetFieldsForTemplateRequestSchema,
  ZSignFieldWithTokenMutationSchema,
  ZUpdateDocumentFieldRequestSchema,
  ZUpdateDocumentFieldsRequestSchema,
  ZUpdateTemplateFieldRequestSchema,
  ZUpdateTemplateFieldsRequestSchema,
} from '../../../server/field-router/schema';
import { ZGenericSuccessResponse } from '../../../server/schema';
import type { ZapContext } from '../context';
import type { ZapRouteMap } from '../dispatch';

export const fieldRoutes: ZapRouteMap = {
  'field.getDocumentField': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { fieldId } = ZGetFieldRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    return await getFieldById({
      userId: ctx.user.id,
      teamId,
      fieldId,
      envelopeType: EnvelopeType.DOCUMENT,
    });
  },

  'field.createDocumentField': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { documentId, field } = ZCreateDocumentFieldRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const createdFields = await createEnvelopeFields({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
      fields: [
        {
          ...field,
          page: field.pageNumber,
          positionX: field.pageX,
          positionY: field.pageY,
        },
      ],
      requestMetadata: ctx.metadata,
    });

    return createdFields.fields[0];
  },

  'field.createDocumentFields': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { documentId, fields } = ZCreateDocumentFieldsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    return await createEnvelopeFields({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
      fields: fields.map((field) => ({
        ...field,
        page: field.pageNumber,
        positionX: field.pageX,
        positionY: field.pageY,
      })),
      requestMetadata: ctx.metadata,
    });
  },

  'field.updateDocumentField': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { documentId, field } = ZUpdateDocumentFieldRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const updatedFields = await updateEnvelopeFields({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
      type: EnvelopeType.DOCUMENT,
      fields: [field],
      requestMetadata: ctx.metadata,
    });

    return updatedFields.fields[0];
  },

  'field.updateDocumentFields': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { documentId, fields } = ZUpdateDocumentFieldsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    return await updateEnvelopeFields({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
      type: EnvelopeType.DOCUMENT,
      fields,
      requestMetadata: ctx.metadata,
    });
  },

  'field.deleteDocumentField': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { fieldId } = ZDeleteDocumentFieldRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    await deleteDocumentField({
      userId: ctx.user.id,
      teamId,
      fieldId,
      requestMetadata: ctx.metadata,
    });

    return ZGenericSuccessResponse;
  },

  'field.setFieldsForDocument': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { documentId, fields } = ZSetDocumentFieldsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    return await setFieldsForDocument({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
      fields: fields.map((field) => ({
        id: field.id,
        recipientId: field.recipientId,
        envelopeItemId: field.envelopeItemId,
        type: field.type,
        pageNumber: field.pageNumber,
        pageX: field.pageX,
        pageY: field.pageY,
        pageWidth: field.pageWidth,
        pageHeight: field.pageHeight,
        fieldMeta: field.fieldMeta,
      })),
      requestMetadata: ctx.metadata,
    });
  },

  'field.createTemplateField': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { templateId, field } = ZCreateTemplateFieldRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    const createdFields = await createEnvelopeFields({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'templateId',
        id: templateId,
      },
      fields: [
        {
          ...field,
          page: field.pageNumber,
          positionX: field.pageX,
          positionY: field.pageY,
        },
      ],
      requestMetadata: ctx.metadata,
    });

    return createdFields.fields[0];
  },

  'field.getTemplateField': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { fieldId } = ZGetFieldRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    return await getFieldById({
      userId: ctx.user.id,
      teamId,
      fieldId,
      envelopeType: EnvelopeType.TEMPLATE,
    });
  },

  'field.createTemplateFields': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { templateId, fields } = ZCreateTemplateFieldsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    return await createEnvelopeFields({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'templateId',
        id: templateId,
      },
      fields: fields.map((field) => ({
        ...field,
        page: field.pageNumber,
        positionX: field.pageX,
        positionY: field.pageY,
      })),
      requestMetadata: ctx.metadata,
    });
  },

  'field.updateTemplateField': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { templateId, field } = ZUpdateTemplateFieldRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    const updatedFields = await updateEnvelopeFields({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'templateId',
        id: templateId,
      },
      type: EnvelopeType.TEMPLATE,
      fields: [field],
      requestMetadata: ctx.metadata,
    });

    return updatedFields.fields[0];
  },

  'field.updateTemplateFields': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { templateId, fields } = ZUpdateTemplateFieldsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    return await updateEnvelopeFields({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'templateId',
        id: templateId,
      },
      type: EnvelopeType.TEMPLATE,
      fields,
      requestMetadata: ctx.metadata,
    });
  },

  'field.deleteTemplateField': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { fieldId } = ZDeleteTemplateFieldRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    await deleteTemplateField({
      userId: ctx.user.id,
      teamId,
      fieldId,
    });

    return ZGenericSuccessResponse;
  },

  'field.setFieldsForTemplate': async (ctx: ZapContext, raw) => {
    const { teamId } = ctx;
    const { templateId, fields } = ZSetFieldsForTemplateRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        templateId,
      },
    });

    return await setFieldsForTemplate({
      id: {
        type: 'templateId',
        id: templateId,
      },
      userId: ctx.user.id,
      teamId,
      fields: fields.map((field) => ({
        id: field.id,
        recipientId: field.recipientId,
        envelopeItemId: field.envelopeItemId,
        type: field.type,
        pageNumber: field.pageNumber,
        pageX: field.pageX,
        pageY: field.pageY,
        pageWidth: field.pageWidth,
        pageHeight: field.pageHeight,
        fieldMeta: field.fieldMeta,
      })),
    });
  },

  'field.signFieldWithToken': async (ctx: ZapContext, raw) => {
    const { token, fieldId, value, isBase64, authOptions } =
      ZSignFieldWithTokenMutationSchema.parse(raw);

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    return await signFieldWithToken({
      token,
      fieldId,
      value: value ?? '',
      isBase64,
      userId: ctx.user?.id,
      authOptions,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  },

  'field.removeSignedFieldWithToken': async (ctx: ZapContext, raw) => {
    const { token, fieldId } = ZRemovedSignedFieldWithTokenMutationSchema.parse(raw);

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    return await removeSignedFieldWithToken({
      token,
      fieldId,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  },
};
