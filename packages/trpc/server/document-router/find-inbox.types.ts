import type { z } from 'zod';

import { ZDocumentManySchema } from '@hanzo/esign-lib/types/document';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@hanzo/esign-lib/types/search-params';

export const ZFindInboxRequestSchema = ZFindSearchParamsSchema;

export const ZFindInboxResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentManySchema.array(),
});

export type TFindInboxResponse = z.infer<typeof ZFindInboxResponseSchema>;
