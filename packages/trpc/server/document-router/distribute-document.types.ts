import { z } from 'zod';

import { ZDocumentLiteSchema } from '@hanzo/esign-lib/types/document';
import { ZDocumentEmailSettingsSchema } from '@hanzo/esign-lib/types/document-email';
import {
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaDistributionMethodSchema,
  ZDocumentMetaLanguageSchema,
  ZDocumentMetaMessageSchema,
  ZDocumentMetaRedirectUrlSchema,
  ZDocumentMetaSubjectSchema,
  ZDocumentMetaTimezoneSchema,
} from '@hanzo/esign-lib/types/document-meta';

export const ZDistributeDocumentRequestSchema = z.object({
  documentId: z.number().describe('The ID of the document to send.'),
  meta: z
    .object({
      subject: ZDocumentMetaSubjectSchema.optional(),
      message: ZDocumentMetaMessageSchema.optional(),
      timezone: ZDocumentMetaTimezoneSchema.optional(),
      dateFormat: ZDocumentMetaDateFormatSchema.optional(),
      distributionMethod: ZDocumentMetaDistributionMethodSchema.optional(),
      redirectUrl: ZDocumentMetaRedirectUrlSchema.optional(),
      language: ZDocumentMetaLanguageSchema.optional(),
      emailId: z.string().nullish(),
      emailReplyTo: z.string().email().nullish(),
      emailSettings: ZDocumentEmailSettingsSchema.optional(),
    })
    .optional(),
});

export const ZDistributeDocumentResponseSchema = ZDocumentLiteSchema;

export type TDistributeDocumentRequest = z.infer<typeof ZDistributeDocumentRequestSchema>;
export type TDistributeDocumentResponse = z.infer<typeof ZDistributeDocumentResponseSchema>;
