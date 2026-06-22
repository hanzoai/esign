import { z } from 'zod';

import { ZDocumentManySchema } from '@hanzo/esign-lib/types/document';

export const ZGetDocumentsByIdsRequestSchema = z.object({
  documentIds: z.array(z.number()).min(1),
});

export const ZGetDocumentsByIdsResponseSchema = z.object({
  data: z.array(ZDocumentManySchema),
});

export type TGetDocumentsByIdsRequest = z.infer<typeof ZGetDocumentsByIdsRequestSchema>;
export type TGetDocumentsByIdsResponse = z.infer<typeof ZGetDocumentsByIdsResponseSchema>;
