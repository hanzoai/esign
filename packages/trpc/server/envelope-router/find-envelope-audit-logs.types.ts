import { z } from 'zod';

import { ZDocumentAuditLogSchema } from '@hanzo/sign-lib/types/document-audit-logs';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@hanzo/sign-lib/types/search-params';

export const ZFindEnvelopeAuditLogsRequestSchema = ZFindSearchParamsSchema.omit({
  query: true,
}).extend({
  envelopeId: z.string().describe('Envelope ID'),
  orderByColumn: z.enum(['createdAt']).optional(),
  orderByDirection: z.enum(['asc', 'desc']).optional(),
});

export const ZFindEnvelopeAuditLogsResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentAuditLogSchema.array(),
});

export type TFindEnvelopeAuditLogsRequest = z.infer<typeof ZFindEnvelopeAuditLogsRequestSchema>;
export type TFindEnvelopeAuditLogsResponse = z.infer<typeof ZFindEnvelopeAuditLogsResponseSchema>;
