import { z } from 'zod';

import { ZSuccessResponseSchema } from '../schema';

export const ZDeleteEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
});

export const ZDeleteEnvelopeResponseSchema = ZSuccessResponseSchema;

export type TDeleteEnvelopeRequest = z.infer<typeof ZDeleteEnvelopeRequestSchema>;
export type TDeleteEnvelopeResponse = z.infer<typeof ZDeleteEnvelopeResponseSchema>;
