import { z } from 'zod';

import { ZDocumentAuditLogSchema } from '@hanzo/sign-lib/types/document-audit-logs';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@hanzo/sign-lib/types/search-params';

export const ZFindDocumentAuditLogsRequestSchema = ZFindSearchParamsSchema.extend({
  envelopeId: z.string(),
  orderByColumn: z.enum(['createdAt']).optional(),
  orderByDirection: z.enum(['asc', 'desc']).optional(),
});

export const ZFindDocumentAuditLogsResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentAuditLogSchema.array(),
});

export type TFindDocumentAuditLogsRequest = z.infer<typeof ZFindDocumentAuditLogsRequestSchema>;
export type TFindDocumentAuditLogsResponse = z.infer<typeof ZFindDocumentAuditLogsResponseSchema>;
