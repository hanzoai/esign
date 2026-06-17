import { z } from 'zod';

import { ZSuccessResponseSchema } from '../../schema';

export const ZDeleteEnvelopeRecipientRequestSchema = z.object({
  recipientId: z.number(),
});

export const ZDeleteEnvelopeRecipientResponseSchema = ZSuccessResponseSchema;

export type TDeleteEnvelopeRecipientRequest = z.infer<typeof ZDeleteEnvelopeRecipientRequestSchema>;
export type TDeleteEnvelopeRecipientResponse = z.infer<
  typeof ZDeleteEnvelopeRecipientResponseSchema
>;
