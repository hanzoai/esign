import { z } from 'zod';

import { ZSuccessResponseSchema } from '../schema';
import { ZRecipientWithSigningUrlSchema } from './schema';

export const ZRedistributeEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
  recipients: z
    .array(z.number())
    .min(1)
    .describe('The IDs of the recipients to redistribute the envelope to.'),
});

export const ZRedistributeEnvelopeResponseSchema = ZSuccessResponseSchema.extend({
  id: z.string().describe('The ID of the envelope that was redistributed.'),
  recipients: ZRecipientWithSigningUrlSchema.array(),
});

export type TRedistributeEnvelopeRequest = z.infer<typeof ZRedistributeEnvelopeRequestSchema>;
export type TRedistributeEnvelopeResponse = z.infer<typeof ZRedistributeEnvelopeResponseSchema>;
