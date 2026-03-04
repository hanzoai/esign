import { OrganisationMemberInviteStatus } from '@prisma/client';
import { z } from 'zod';

import { OrganisationMemberInviteSchema } from '@hanzo/sign-prisma/generated/zod/modelSchema/OrganisationMemberInviteSchema';
import OrganisationSchema from '@hanzo/sign-prisma/generated/zod/modelSchema/OrganisationSchema';

export const ZGetOrganisationMemberInvitesRequestSchema = z.object({
  status: z.nativeEnum(OrganisationMemberInviteStatus).optional(),
});

export const ZGetOrganisationMemberInvitesResponseSchema = OrganisationMemberInviteSchema.pick({
  id: true,
  organisationId: true,
  email: true,
  createdAt: true,
  token: true,
})
  .extend({
    organisation: OrganisationSchema.pick({
      id: true,
      name: true,
      url: true,
      avatarImageId: true,
    }),
  })
  .array();

export type TGetOrganisationMemberInvitesResponse = z.infer<
  typeof ZGetOrganisationMemberInvitesResponseSchema
>;
