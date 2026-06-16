import { z } from 'zod';

export const ZCreateEmbeddingPresignTokenRequestSchema = z.object({
  expiresIn: z
    .number()
    .min(0)
    .max(10080)
    .optional()
    .default(60)
    .describe('Expiration time in minutes (default: 60, max: 10,080)'),
  scope: z
    .string()
    .optional()
    .describe(
      'Resource restriction. V1 embeds only support documentId:1, templateId:2. V2 embeds only support envelopeId:envelope_123',
    ),
});

export const ZCreateEmbeddingPresignTokenResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.date(),
  expiresIn: z.number().describe('Expiration time in seconds'),
});

export type TCreateEmbeddingPresignTokenRequestSchema = z.infer<
  typeof ZCreateEmbeddingPresignTokenRequestSchema
>;

export type TCreateEmbeddingPresignTokenResponseSchema = z.infer<
  typeof ZCreateEmbeddingPresignTokenResponseSchema
>;
