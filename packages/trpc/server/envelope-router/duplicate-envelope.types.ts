import { z } from 'zod';

export const ZDuplicateEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
});

export const ZDuplicateEnvelopeResponseSchema = z.object({
  id: z.string().describe('The ID of the newly created envelope.'),
});

export type TDuplicateEnvelopeRequest = z.infer<typeof ZDuplicateEnvelopeRequestSchema>;
export type TDuplicateEnvelopeResponse = z.infer<typeof ZDuplicateEnvelopeResponseSchema>;
