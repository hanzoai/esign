import { z } from 'zod';

import { ZDocumentSchema } from '@hanzo/sign-lib/types/document';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@hanzo/sign-lib/types/document-auth';
import { ZDocumentFormValuesSchema } from '@hanzo/sign-lib/types/document-form-values';
import { ZDocumentMetaCreateSchema } from '@hanzo/sign-lib/types/document-meta';
import { ZEnvelopeAttachmentTypeSchema } from '@hanzo/sign-lib/types/envelope-attachment';
import {
  ZFieldHeightSchema,
  ZFieldPageNumberSchema,
  ZFieldPageXSchema,
  ZFieldPageYSchema,
  ZFieldWidthSchema,
} from '@hanzo/sign-lib/types/field';
import { ZFieldAndMetaSchema } from '@hanzo/sign-lib/types/field-meta';

import { ZCreateRecipientSchema } from '../recipient-router/schema';
import {
  ZDocumentExternalIdSchema,
  ZDocumentTitleSchema,
  ZDocumentVisibilitySchema,
} from './schema';

/**
 * Temporariy endpoint for V2 Beta until we allow passthrough documents on create.
 * @deprecated
 */

export const ZCreateDocumentTemporaryRequestSchema = z.object({
  title: ZDocumentTitleSchema,
  externalId: ZDocumentExternalIdSchema.optional(),
  visibility: ZDocumentVisibilitySchema.optional(),
  globalAccessAuth: z.array(ZDocumentAccessAuthTypesSchema).optional(),
  globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional(),
  formValues: ZDocumentFormValuesSchema.optional(),
  folderId: z
    .string()
    .describe(
      'The ID of the folder to create the document in. If not provided, the document will be created in the root folder.',
    )
    .optional(),
  recipients: z
    .array(
      ZCreateRecipientSchema.extend({
        fields: ZFieldAndMetaSchema.and(
          z.object({
            pageNumber: ZFieldPageNumberSchema,
            pageX: ZFieldPageXSchema,
            pageY: ZFieldPageYSchema,
            width: ZFieldWidthSchema,
            height: ZFieldHeightSchema,
          }),
        )
          .array()
          .optional(),
      }),
    )

    .optional(),
  attachments: z
    .array(
      z.object({
        label: z.string().min(1, 'Label is required'),
        data: z.string().url('Must be a valid URL'),
        type: ZEnvelopeAttachmentTypeSchema.optional().default('link'),
      }),
    )
    .optional(),
  meta: ZDocumentMetaCreateSchema.optional(),
});

export const ZCreateDocumentTemporaryResponseSchema = z.object({
  document: ZDocumentSchema,
  uploadUrl: z
    .string()
    .describe(
      'The URL to upload the document PDF to. Use a PUT request with the file via form-data',
    ),
});

export type TCreateDocumentTemporaryRequest = z.infer<typeof ZCreateDocumentTemporaryRequestSchema>;
export type TCreateDocumentTemporaryResponse = z.infer<
  typeof ZCreateDocumentTemporaryResponseSchema
>;
