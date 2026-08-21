import { z } from 'zod';

import { ZEnvelopeRecipientSchema } from '@hanzo/esign-lib/types/recipient';

export const ZGetEnvelopeRecipientRequestSchema = z.object({
  recipientId: z.coerce.number(),
});

export const ZGetEnvelopeRecipientResponseSchema = ZEnvelopeRecipientSchema;

export type TGetEnvelopeRecipientRequest = z.infer<typeof ZGetEnvelopeRecipientRequestSchema>;
export type TGetEnvelopeRecipientResponse = z.infer<typeof ZGetEnvelopeRecipientResponseSchema>;
