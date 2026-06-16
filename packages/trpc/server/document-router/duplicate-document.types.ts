import { z } from 'zod';

export const ZDuplicateDocumentRequestSchema = z.object({
  documentId: z.number(),
});

export const ZDuplicateDocumentResponseSchema = z.object({
  id: z.string().describe('The envelope ID'),
  documentId: z.number().describe('The legacy document ID'),
});

export type TDuplicateDocumentRequest = z.infer<typeof ZDuplicateDocumentRequestSchema>;
export type TDuplicateDocumentResponse = z.infer<typeof ZDuplicateDocumentResponseSchema>;
