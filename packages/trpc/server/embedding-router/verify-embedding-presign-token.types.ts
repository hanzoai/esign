import { z } from 'zod';

export const ZVerifyEmbeddingPresignTokenRequestSchema = z.object({
  token: z
    .string()
    .min(1, { message: 'Token is required' })
    .describe('The presign token to verify'),
  scope: z.string().optional().describe('The scope to verify'),
});

export const ZVerifyEmbeddingPresignTokenResponseSchema = z.object({
  success: z.boolean(),
});

export type TVerifyEmbeddingPresignTokenRequestSchema = z.infer<
  typeof ZVerifyEmbeddingPresignTokenRequestSchema
>;

export type TVerifyEmbeddingPresignTokenResponseSchema = z.infer<
  typeof ZVerifyEmbeddingPresignTokenResponseSchema
>;
