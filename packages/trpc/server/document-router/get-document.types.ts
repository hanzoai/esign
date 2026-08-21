import { z } from 'zod';

import { ZDocumentSchema } from '@hanzo/esign-lib/types/document';

export const ZGetDocumentRequestSchema = z.object({
  documentId: z.coerce.number(),
});

export const ZGetDocumentResponseSchema = ZDocumentSchema;

export type TGetDocumentRequest = z.infer<typeof ZGetDocumentRequestSchema>;
export type TGetDocumentResponse = z.infer<typeof ZGetDocumentResponseSchema>;
