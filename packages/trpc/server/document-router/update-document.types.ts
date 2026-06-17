import { z } from 'zod';

import { ZDocumentLiteSchema } from '@hanzo/sign-lib/types/document';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@hanzo/sign-lib/types/document-auth';
import { ZDocumentMetaUpdateSchema } from '@hanzo/sign-lib/types/document-meta';

import {
  ZDocumentExternalIdSchema,
  ZDocumentTitleSchema,
  ZDocumentVisibilitySchema,
} from './schema';

export const ZUpdateDocumentRequestSchema = z.object({
  documentId: z.number(),
  data: z
    .object({
      title: ZDocumentTitleSchema.optional(),
      externalId: ZDocumentExternalIdSchema.nullish(),
      visibility: ZDocumentVisibilitySchema.optional(),
      globalAccessAuth: z.array(ZDocumentAccessAuthTypesSchema).optional(),
      globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional(),
      useLegacyFieldInsertion: z.boolean().optional(),
      folderId: z.string().nullish(),
    })
    .optional(),
  meta: ZDocumentMetaUpdateSchema.optional(),
});

export const ZUpdateDocumentResponseSchema = ZDocumentLiteSchema;
