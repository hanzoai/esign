import { z } from 'zod';

import { ZTemplateManySchema } from '@hanzo/sign-lib/types/template';

export const ZGetTemplatesByIdsRequestSchema = z.object({
  templateIds: z.array(z.number()).min(1),
});

export const ZGetTemplatesByIdsResponseSchema = z.object({
  data: z.array(ZTemplateManySchema),
});

export type TGetTemplatesByIdsRequest = z.infer<typeof ZGetTemplatesByIdsRequestSchema>;
export type TGetTemplatesByIdsResponse = z.infer<typeof ZGetTemplatesByIdsResponseSchema>;
