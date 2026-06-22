import { DocumentSource, DocumentStatus, EnvelopeType } from '@prisma/client';
import { z } from 'zod';

import { ZEnvelopeManySchema } from '@hanzo/esign-lib/types/envelope';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@hanzo/esign-lib/types/search-params';

export const ZFindEnvelopesRequestSchema = ZFindSearchParamsSchema.extend({
  type: z
    .nativeEnum(EnvelopeType)
    .describe('Filter envelopes by type (DOCUMENT or TEMPLATE).')
    .optional(),
  templateId: z
    .number()
    .describe('Filter envelopes by the template ID used to create it.')
    .optional(),
  source: z
    .nativeEnum(DocumentSource)
    .describe('Filter envelopes by how it was created.')
    .optional(),
  status: z
    .nativeEnum(DocumentStatus)
    .describe('Filter envelopes by the current status.')
    .optional(),
  folderId: z.string().describe('Filter envelopes by folder ID.').optional(),
  orderByColumn: z.enum(['createdAt']).optional(),
  orderByDirection: z.enum(['asc', 'desc']).describe('Sort direction.').default('desc'),
});

export const ZFindEnvelopesResponseSchema = ZFindResultResponse.extend({
  data: ZEnvelopeManySchema.array(),
});

export type TFindEnvelopesRequest = z.infer<typeof ZFindEnvelopesRequestSchema>;
export type TFindEnvelopesResponse = z.infer<typeof ZFindEnvelopesResponseSchema>;
