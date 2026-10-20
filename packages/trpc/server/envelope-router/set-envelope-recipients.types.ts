import { EnvelopeType, RecipientRole } from '@prisma/client';
import { z } from 'zod';

import { ZRecipientActionAuthTypesSchema } from '@hanzo/esign-lib/types/document-auth';
import { ZRecipientEmailSchema, ZRecipientLiteSchema } from '@hanzo/esign-lib/types/recipient';

export const ZSetEnvelopeRecipientSchema = z.object({
  id: z.number().optional(),
  // The editor's stable key for the row, echoed back on the response so a
  // recipient created by one autosave is updated, not recreated, by the next.
  clientId: z.string().optional(),
  email: ZRecipientEmailSchema,
  name: z.string().max(255),
  role: z.nativeEnum(RecipientRole),
  signingOrder: z.number().optional(),
  actionAuth: z.array(ZRecipientActionAuthTypesSchema).optional().default([]),
});

export const ZSetEnvelopeRecipientsRequestSchema = z.object({
  envelopeId: z.string(),
  envelopeType: z.nativeEnum(EnvelopeType),
  recipients: ZSetEnvelopeRecipientSchema.array(),
});

export const ZSetEnvelopeRecipientsResponseSchema = z.object({
  data: ZRecipientLiteSchema.omit({
    documentId: true,
    templateId: true,
  })
    .extend({
      clientId: z.string().nullish(),
    })
    .array(),
});

export type TSetEnvelopeRecipientsRequest = z.infer<typeof ZSetEnvelopeRecipientsRequestSchema>;
export type TSetEnvelopeRecipientsResponse = z.infer<typeof ZSetEnvelopeRecipientsResponseSchema>;
