import { z } from 'zod';

import { ZSuccessResponseSchema } from '../schema';

export const ZDeleteEnvelopeItemRequestSchema = z.object({
  envelopeId: z.string(),
  envelopeItemId: z.string(),
});

export const ZDeleteEnvelopeItemResponseSchema = ZSuccessResponseSchema;

export type TDeleteEnvelopeItemRequest = z.infer<typeof ZDeleteEnvelopeItemRequestSchema>;
export type TDeleteEnvelopeItemResponse = z.infer<typeof ZDeleteEnvelopeItemResponseSchema>;
