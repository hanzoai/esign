import { z } from 'zod';

import { ZDocumentSchema } from '@hanzo/sign-lib/types/document';

export const ZGetDocumentRequestSchema = z.object({
  documentId: z.number(),
});

export const ZGetDocumentResponseSchema = ZDocumentSchema;

export type TGetDocumentRequest = z.infer<typeof ZGetDocumentRequestSchema>;
export type TGetDocumentResponse = z.infer<typeof ZGetDocumentResponseSchema>;
