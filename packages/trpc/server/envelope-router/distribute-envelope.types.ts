import { z } from 'zod';

import { ZDocumentMetaUpdateSchema } from '@hanzo/sign-lib/types/document-meta';

import { ZSuccessResponseSchema } from '../schema';
import { ZRecipientWithSigningUrlSchema } from './schema';

export const ZDistributeEnvelopeRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope to send.'),
  meta: ZDocumentMetaUpdateSchema.pick({
    subject: true,
    message: true,
    timezone: true,
    dateFormat: true,
    distributionMethod: true,
    redirectUrl: true,
    language: true,
    emailId: true,
    emailReplyTo: true,
    emailSettings: true,
  }).optional(),
});

export const ZDistributeEnvelopeResponseSchema = ZSuccessResponseSchema.extend({
  id: z.string().describe('The ID of the envelope that was sent.'),
  recipients: ZRecipientWithSigningUrlSchema.array(),
});

export type TDistributeEnvelopeRequest = z.infer<typeof ZDistributeEnvelopeRequestSchema>;
export type TDistributeEnvelopeResponse = z.infer<typeof ZDistributeEnvelopeResponseSchema>;
