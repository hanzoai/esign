import { z } from 'zod';

import { ZOrganisationSchema } from '@hanzo/sign-lib/types/organisation';
import OrganisationClaimSchema from '@hanzo/sign-prisma/generated/zod/modelSchema/OrganisationClaimSchema';
import OrganisationGlobalSettingsSchema from '@hanzo/sign-prisma/generated/zod/modelSchema/OrganisationGlobalSettingsSchema';
import OrganisationGroupMemberSchema from '@hanzo/sign-prisma/generated/zod/modelSchema/OrganisationGroupMemberSchema';
import OrganisationGroupSchema from '@hanzo/sign-prisma/generated/zod/modelSchema/OrganisationGroupSchema';
import OrganisationMemberSchema from '@hanzo/sign-prisma/generated/zod/modelSchema/OrganisationMemberSchema';
import SubscriptionSchema from '@hanzo/sign-prisma/generated/zod/modelSchema/SubscriptionSchema';
import TeamSchema from '@hanzo/sign-prisma/generated/zod/modelSchema/TeamSchema';
import UserSchema from '@hanzo/sign-prisma/generated/zod/modelSchema/UserSchema';

export const ZGetAdminOrganisationRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZGetAdminOrganisationResponseSchema = ZOrganisationSchema.extend({
  organisationGlobalSettings: OrganisationGlobalSettingsSchema,
  teams: z.array(
    TeamSchema.pick({
      id: true,
      name: true,
      url: true,
      createdAt: true,
      avatarImageId: true,
      organisationId: true,
    }),
  ),
  members: OrganisationMemberSchema.extend({
    user: UserSchema.pick({
      id: true,
      email: true,
      name: true,
    }),
    organisationGroupMembers: z.array(
      OrganisationGroupMemberSchema.pick({
        id: true,
        groupId: true,
      }).extend({
        group: OrganisationGroupSchema.pick({
          id: true,
          type: true,
          organisationRole: true,
        }),
      }),
    ),
  }).array(),
  subscription: SubscriptionSchema.nullable(),
  organisationClaim: OrganisationClaimSchema,
});

export type TGetAdminOrganisationResponse = z.infer<typeof ZGetAdminOrganisationResponseSchema>;
