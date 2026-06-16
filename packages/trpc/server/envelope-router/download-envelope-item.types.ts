import { z } from 'zod';

export const ZDownloadEnvelopeItemRequestSchema = z.object({
  envelopeItemId: z.string().describe('The ID of the envelope item to download.'),
  version: z
    .enum(['original', 'signed'])
    .describe(
      'The version of the envelope item to download. "signed" returns the completed document with signatures, "original" returns the original uploaded document.',
    )
    .default('signed'),
});

export const ZDownloadEnvelopeItemResponseSchema = z.instanceof(Uint8Array);

export type TDownloadEnvelopeItemRequest = z.infer<typeof ZDownloadEnvelopeItemRequestSchema>;
export type TDownloadEnvelopeItemResponse = z.infer<typeof ZDownloadEnvelopeItemResponseSchema>;
