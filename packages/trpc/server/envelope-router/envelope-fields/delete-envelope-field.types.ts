import { z } from 'zod';

import { ZSuccessResponseSchema } from '../../schema';

export const ZDeleteEnvelopeFieldRequestSchema = z.object({
  fieldId: z.number(),
});

export const ZDeleteEnvelopeFieldResponseSchema = ZSuccessResponseSchema;

export type TDeleteEnvelopeFieldRequest = z.infer<typeof ZDeleteEnvelopeFieldRequestSchema>;
export type TDeleteEnvelopeFieldResponse = z.infer<typeof ZDeleteEnvelopeFieldResponseSchema>;
