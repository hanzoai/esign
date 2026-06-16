import { z } from 'zod';

import { ZSuccessResponseSchema } from '../schema';

export const ZRedistributeDocumentRequestSchema = z.object({
  documentId: z.number(),
  recipients: z
    .array(z.number())
    .min(1)
    .describe('The IDs of the recipients to redistribute the document to.'),
});

export const ZRedistributeDocumentResponseSchema = ZSuccessResponseSchema;

export type TRedistributeDocumentRequest = z.infer<typeof ZRedistributeDocumentRequestSchema>;
export type TRedistributeDocumentResponse = z.infer<typeof ZRedistributeDocumentResponseSchema>;
