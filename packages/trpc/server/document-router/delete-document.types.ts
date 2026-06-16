import { z } from 'zod';

import { ZSuccessResponseSchema } from '../schema';

export const ZDeleteDocumentRequestSchema = z.object({
  documentId: z.number(),
});

export const ZDeleteDocumentResponseSchema = ZSuccessResponseSchema;

export type TDeleteDocumentRequest = z.infer<typeof ZDeleteDocumentRequestSchema>;
export type TDeleteDocumentResponse = z.infer<typeof ZDeleteDocumentResponseSchema>;
