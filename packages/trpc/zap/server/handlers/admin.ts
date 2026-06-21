// esign ZAP handlers — admin router (30/30 procedures).
//
// Verbatim tRPC procedure bodies rewired to (ctx, raw). Input is validated by
// the SAME Zod schema the tRPC procedure used; the server-only functions and
// the per-route exported helpers (getAdminOrganisation / findAdminOrganisations
// / findSubscriptionClaims / resetTwoFactor) are reused unchanged. The two
// non-exported tRPC helpers (findUserTeams / findEmailDomains) have their bodies
// ported inline. Route keys mirror the tRPC nested router shape (see
// admin-router.zap).
//
// SECURITY — admin re-assertion: tRPC's `adminProcedure` runs `adminMiddleware`
// (server/trpc.ts), which throws UNAUTHORIZED unless `isAdmin(ctx.user)`. The
// ZAP MintCap (mint.ts) only establishes user identity; it does NOT carry the
// `roles` needed for `isAdmin`. So every handler below calls `assertAdmin(ctx)`
// first, which loads the caller's roles via getUserById and replicates the
// exact `isAdmin` check — re-asserting the admin boundary the middleware enforced.
import {
  EnvelopeType,
  OrganisationGroupType,
  OrganisationMemberRole,
  OrganisationType,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';

import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { jobs, jobsClient } from '@hanzo/sign-lib/jobs/client';
import { adminFindDocuments } from '@hanzo/sign-lib/server-only/admin/admin-find-documents';
import { adminFindUnsealedDocuments } from '@hanzo/sign-lib/server-only/admin/admin-find-unsealed-documents';
import { adminSuperDeleteDocument } from '@hanzo/sign-lib/server-only/admin/admin-super-delete-document';
import { unsafeGetEntireEnvelope } from '@hanzo/sign-lib/server-only/admin/get-entire-document';
import { updateRecipient } from '@hanzo/sign-lib/server-only/admin/update-recipient';
import { updateUser } from '@hanzo/sign-lib/server-only/admin/update-user';
import { sendDeleteEmail } from '@hanzo/sign-lib/server-only/document/send-delete-email';
import { reregisterEmailDomain } from '@hanzo/sign-lib/server-only/email-domain/reregister-email-domain';
import { LicenseClient } from '@hanzo/sign-lib/server-only/license/license-client';
import {
  createOrganisation,
  createOrganisationClaimUpsertData,
} from '@hanzo/sign-lib/server-only/organisation/create-organisation';
import { upsertSiteSetting } from '@hanzo/sign-lib/server-only/site-settings/upsert-site-setting';
import { deleteUser } from '@hanzo/sign-lib/server-only/user/delete-user';
import { disableUser } from '@hanzo/sign-lib/server-only/user/disable-user';
import { enableUser } from '@hanzo/sign-lib/server-only/user/enable-user';
import { getUserById } from '@hanzo/sign-lib/server-only/user/get-user-by-id';
import type { FindResultResponse } from '@hanzo/sign-lib/types/search-params';
import { INTERNAL_CLAIM_ID, internalClaims } from '@hanzo/sign-lib/types/subscription';
import type { TClaimFlags } from '@hanzo/sign-lib/types/subscription';
import { generateDatabaseId } from '@hanzo/sign-lib/universal/id';
import { isDocumentCompleted, mapEnvelopesToDocumentMany } from '@hanzo/sign-lib/utils/document';
import { parseDocumentAuditLogData } from '@hanzo/sign-lib/utils/document-audit-logs';
import {
  mapSecondaryIdToDocumentId,
  unsafeBuildEnvelopeIdQuery,
} from '@hanzo/sign-lib/utils/envelope';
import { isAdmin } from '@hanzo/sign-lib/utils/is-admin';
import { getHighestOrganisationRoleInGroup } from '@hanzo/sign-lib/utils/organisations';
import { getHighestTeamRoleInGroup } from '@hanzo/sign-lib/utils/teams';
import { prisma } from '@hanzo/sign-prisma';

import { ZCreateAdminOrganisationRequestSchema } from '../../../server/admin-router/create-admin-organisation.types';
import { ZCreateSubscriptionClaimRequestSchema } from '../../../server/admin-router/create-subscription-claim.types';
import { ZDeleteDocumentRequestSchema } from '../../../server/admin-router/delete-document.types';
import { ZDeleteSubscriptionClaimRequestSchema } from '../../../server/admin-router/delete-subscription-claim.types';
import { ZDeleteUserRequestSchema } from '../../../server/admin-router/delete-user.types';
import { ZDisableUserRequestSchema } from '../../../server/admin-router/disable-user.types';
import { ZEnableUserRequestSchema } from '../../../server/admin-router/enable-user.types';
import { findAdminOrganisations } from '../../../server/admin-router/find-admin-organisations';
import { ZFindAdminOrganisationsRequestSchema } from '../../../server/admin-router/find-admin-organisations.types';
import { ZFindDocumentAuditLogsRequestSchema } from '../../../server/admin-router/find-document-audit-logs.types';
import { ZFindDocumentJobsRequestSchema } from '../../../server/admin-router/find-document-jobs.types';
import { ZFindDocumentsRequestSchema } from '../../../server/admin-router/find-documents.types';
import { ZFindEmailDomainsRequestSchema } from '../../../server/admin-router/find-email-domains.types';
import { findSubscriptionClaims } from '../../../server/admin-router/find-subscription-claims';
import { ZFindSubscriptionClaimsRequestSchema } from '../../../server/admin-router/find-subscription-claims.types';
import { ZFindUnsealedDocumentsRequestSchema } from '../../../server/admin-router/find-unsealed-documents.types';
import { ZFindUserTeamsRequestSchema } from '../../../server/admin-router/find-user-teams.types';
import { getAdminOrganisation } from '../../../server/admin-router/get-admin-organisation';
import { ZGetAdminOrganisationRequestSchema } from '../../../server/admin-router/get-admin-organisation.types';
import { ZGetEmailDomainRequestSchema } from '../../../server/admin-router/get-email-domain.types';
import { ZGetUserRequestSchema } from '../../../server/admin-router/get-user.types';
import { ZPromoteMemberToOwnerRequestSchema } from '../../../server/admin-router/promote-member-to-owner.types';
import { ZReregisterEmailDomainRequestSchema } from '../../../server/admin-router/reregister-email-domain.types';
import { ZResealDocumentRequestSchema } from '../../../server/admin-router/reseal-document.types';
import { resetTwoFactor } from '../../../server/admin-router/reset-two-factor-authentication';
import { ZResetTwoFactorRequestSchema } from '../../../server/admin-router/reset-two-factor-authentication.types';
import { ZResyncLicenseRequestSchema } from '../../../server/admin-router/resync-license.types';
import { ZSwapOrganisationSubscriptionRequestSchema } from '../../../server/admin-router/swap-organisation-subscription.types';
import { ZUpdateAdminOrganisationRequestSchema } from '../../../server/admin-router/update-admin-organisation.types';
import { ZUpdateOrganisationMemberRoleRequestSchema } from '../../../server/admin-router/update-organisation-member-role.types';
import { ZUpdateRecipientRequestSchema } from '../../../server/admin-router/update-recipient.types';
import { ZUpdateSiteSettingRequestSchema } from '../../../server/admin-router/update-site-setting.types';
import { ZUpdateSubscriptionClaimRequestSchema } from '../../../server/admin-router/update-subscription-claim.types';
import { ZUpdateUserRequestSchema } from '../../../server/admin-router/update-user.types';
import type { ZapContext } from '../context';
import type { ZapRouteMap } from '../dispatch';

/**
 * Re-assert the admin boundary that tRPC's `adminMiddleware` enforced.
 *
 * The MintCap only proves user identity (id/name/email) — it does NOT carry
 * `roles`. We load the caller's roles by id and apply the SAME `isAdmin` check
 * the middleware used. A non-admin caller is rejected with UNAUTHORIZED, exactly
 * like `adminProcedure` would have.
 */
async function assertAdmin(ctx: ZapContext): Promise<void> {
  const user = await getUserById({ id: ctx.user.id }).catch(() => null);

  if (!user || !isAdmin(user)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Not authorized to perform this action.',
    });
  }
}

function getNewTruthyFlags(
  a: Partial<TClaimFlags>,
  b: Partial<TClaimFlags>,
): Record<keyof TClaimFlags, true> {
  const flags: { [key in keyof TClaimFlags]?: true } = {};

  for (const key in b) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const typedKey = key as keyof TClaimFlags;

    if (b[typedKey] === true && a[typedKey] !== true) {
      flags[typedKey] = true;
    }
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return flags as Record<keyof TClaimFlags, true>;
}

export const adminRoutes: ZapRouteMap = {
  'admin.organisation.find': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { query, page, perPage, ownerUserId, memberUserId } =
      ZFindAdminOrganisationsRequestSchema.parse(raw);

    return await findAdminOrganisations({
      query,
      page,
      perPage,
      ownerUserId,
      memberUserId,
    });
  },

  'admin.organisation.get': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { organisationId } = ZGetAdminOrganisationRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    return await getAdminOrganisation({
      organisationId,
    });
  },

  'admin.organisation.create': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { ownerUserId, data } = ZCreateAdminOrganisationRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        ownerUserId,
      },
    });

    const organisation = await createOrganisation({
      userId: ownerUserId,
      name: data.name,
      type: OrganisationType.ORGANISATION,
      claim: internalClaims.free,
    });

    return {
      organisationId: organisation.id,
    };
  },

  'admin.organisation.update': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { organisationId, data } = ZUpdateAdminOrganisationRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const organisation = await prisma.organisation.findUnique({
      where: {
        id: organisationId,
      },
      include: {
        organisationClaim: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    const { name, url, customerId, claims, originalSubscriptionClaimId } = data;

    await prisma.organisation.update({
      where: {
        id: organisationId,
      },
      data: {
        name,
        url,
        customerId: customerId ? customerId : undefined,
      },
    });

    await prisma.organisationClaim.update({
      where: {
        id: organisation.organisationClaimId,
      },
      data: {
        ...claims,
        originalSubscriptionClaimId,
      },
    });
  },

  'admin.organisation.swapSubscription': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { sourceOrganisationId, targetOrganisationId } =
      ZSwapOrganisationSubscriptionRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        sourceOrganisationId,
        targetOrganisationId,
      },
    });

    if (sourceOrganisationId === targetOrganisationId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Source and target organisations must be different',
      });
    }

    const sourceOrg = await prisma.organisation.findUnique({
      where: { id: sourceOrganisationId },
      include: {
        subscription: true,
        organisationClaim: true,
      },
    });

    if (!sourceOrg) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Source organisation not found',
      });
    }

    if (
      !sourceOrg.subscription ||
      (sourceOrg.subscription.status !== SubscriptionStatus.ACTIVE &&
        sourceOrg.subscription.status !== SubscriptionStatus.PAST_DUE)
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Source organisation does not have an active subscription',
      });
    }

    const targetOrg = await prisma.organisation.findUnique({
      where: { id: targetOrganisationId },
      include: {
        subscription: true,
        organisationClaim: true,
      },
    });

    if (!targetOrg) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Target organisation not found',
      });
    }

    if (sourceOrg.ownerUserId !== targetOrg.ownerUserId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Both organisations must be owned by the same user',
      });
    }

    if (
      targetOrg.subscription &&
      (targetOrg.subscription.status === SubscriptionStatus.ACTIVE ||
        targetOrg.subscription.status === SubscriptionStatus.PAST_DUE)
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Target organisation already has an active subscription',
      });
    }

    const customerId = sourceOrg.customerId ?? sourceOrg.subscription.customerId;

    await prisma.$transaction(async (tx) => {
      // Delete stale INACTIVE subscription on target if present.
      if (targetOrg.subscription) {
        await tx.subscription.delete({
          where: { id: targetOrg.subscription.id },
        });
      }

      // Clear customerId on source org to avoid unique constraint violation.
      await tx.organisation.update({
        where: { id: sourceOrganisationId },
        data: { customerId: null },
      });

      // Set customerId on target org.
      await tx.organisation.update({
        where: { id: targetOrganisationId },
        data: { customerId },
      });

      // Move the subscription record to the target org.
      await tx.subscription.update({
        where: { id: sourceOrg.subscription!.id },
        data: { organisationId: targetOrganisationId },
      });

      // Copy source org's claim entitlements to target org's claim.
      if (sourceOrg.organisationClaim && targetOrg.organisationClaim) {
        await tx.organisationClaim.update({
          where: { id: targetOrg.organisationClaim.id },
          data: {
            originalSubscriptionClaimId: sourceOrg.organisationClaim.originalSubscriptionClaimId,
            teamCount: sourceOrg.organisationClaim.teamCount,
            memberCount: sourceOrg.organisationClaim.memberCount,
            envelopeItemCount: sourceOrg.organisationClaim.envelopeItemCount,
            flags: sourceOrg.organisationClaim.flags,
          },
        });
      }

      // Reset source org's claim to FREE.
      if (sourceOrg.organisationClaim) {
        await tx.organisationClaim.update({
          where: { id: sourceOrg.organisationClaim.id },
          data: {
            originalSubscriptionClaimId: INTERNAL_CLAIM_ID.FREE,
            ...createOrganisationClaimUpsertData(internalClaims[INTERNAL_CLAIM_ID.FREE]),
          },
        });
      }
    });
  },

  'admin.organisationMember.promoteToOwner': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { organisationId, userId } = ZPromoteMemberToOwnerRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        organisationId,
        userId,
      },
    });

    // First, verify the organisation exists and get member details with groups
    const organisation = await prisma.organisation.findUnique({
      where: {
        id: organisationId,
      },
      include: {
        groups: {
          where: {
            type: OrganisationGroupType.INTERNAL_ORGANISATION,
          },
        },
        members: {
          where: {
            userId,
          },
          include: {
            organisationGroupMembers: {
              include: {
                group: true,
              },
            },
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation not found',
      });
    }

    // Verify the user is a member of the organisation
    const [member] = organisation.members;

    if (!member) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'User is not a member of this organisation',
      });
    }

    // Verify the user is not already the owner
    if (organisation.ownerUserId === userId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'User is already the owner of this organisation',
      });
    }

    // Get current organisation role
    const currentOrganisationRole = getHighestOrganisationRoleInGroup(
      member.organisationGroupMembers.flatMap((member) => member.group),
    );

    // Find the current and target organisation groups
    const currentMemberGroup = organisation.groups.find(
      (group) => group.organisationRole === currentOrganisationRole,
    );

    const adminGroup = organisation.groups.find(
      (group) => group.organisationRole === OrganisationMemberRole.ADMIN,
    );

    if (!currentMemberGroup) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Current member group not found',
      });
    }

    if (!adminGroup) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Admin group not found',
      });
    }

    // Update the organisation owner and member role in a transaction
    await prisma.$transaction(async (tx) => {
      // Update the organisation to set the new owner
      await tx.organisation.update({
        where: {
          id: organisationId,
        },
        data: {
          ownerUserId: userId,
        },
      });

      // Only update role if the user is not already an admin then add them to the admin group
      if (currentOrganisationRole !== OrganisationMemberRole.ADMIN) {
        await tx.organisationGroupMember.create({
          data: {
            id: generateDatabaseId('group_member'),
            organisationMemberId: member.id,
            groupId: adminGroup.id,
          },
        });
      }
    });
  },

  'admin.organisationMember.updateRole': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { organisationId, userId, role } = ZUpdateOrganisationMemberRoleRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        organisationId,
        userId,
        role,
      },
    });

    const organisation = await prisma.organisation.findUnique({
      where: {
        id: organisationId,
      },
      include: {
        groups: {
          where: {
            type: OrganisationGroupType.INTERNAL_ORGANISATION,
          },
        },
        members: {
          where: {
            userId,
          },
          include: {
            organisationGroupMembers: {
              include: {
                group: true,
              },
            },
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation not found',
      });
    }

    const [member] = organisation.members;

    if (!member) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'User is not a member of this organisation',
      });
    }

    const currentOrganisationRole = getHighestOrganisationRoleInGroup(
      member.organisationGroupMembers.flatMap((member) => member.group),
    );

    if (role === 'OWNER') {
      if (organisation.ownerUserId === userId) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'User is already the owner of this organisation',
        });
      }

      const currentMemberGroup = organisation.groups.find(
        (group) => group.organisationRole === currentOrganisationRole,
      );

      const adminGroup = organisation.groups.find(
        (group) => group.organisationRole === OrganisationMemberRole.ADMIN,
      );

      if (!currentMemberGroup) {
        ctx.logger.error({
          message: '[CRITICAL]: Missing internal group',
          organisationId,
          userId,
          role: currentOrganisationRole,
        });

        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Current member group not found',
        });
      }

      if (!adminGroup) {
        ctx.logger.error({
          message: '[CRITICAL]: Missing internal group',
          organisationId,
          userId,
          targetRole: 'ADMIN',
        });

        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Admin group not found',
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.organisation.update({
          where: {
            id: organisationId,
          },
          data: {
            ownerUserId: userId,
          },
        });

        if (currentOrganisationRole !== OrganisationMemberRole.ADMIN) {
          await tx.organisationGroupMember.delete({
            where: {
              organisationMemberId_groupId: {
                organisationMemberId: member.id,
                groupId: currentMemberGroup.id,
              },
            },
          });

          await tx.organisationGroupMember.create({
            data: {
              id: generateDatabaseId('group_member'),
              organisationMemberId: member.id,
              groupId: adminGroup.id,
            },
          });
        }
      });

      return;
    }

    const targetRole = role as OrganisationMemberRole;

    if (currentOrganisationRole === targetRole) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'User already has this role',
      });
    }

    if (userId === organisation.ownerUserId && targetRole !== OrganisationMemberRole.ADMIN) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Organisation owner must be an admin. Transfer ownership first.',
      });
    }

    const currentMemberGroup = organisation.groups.find(
      (group) => group.organisationRole === currentOrganisationRole,
    );

    const newMemberGroup = organisation.groups.find(
      (group) => group.organisationRole === targetRole,
    );

    if (!currentMemberGroup) {
      ctx.logger.error({
        message: '[CRITICAL]: Missing internal group',
        organisationId,
        userId,
        role: currentOrganisationRole,
      });

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Current member group not found',
      });
    }

    if (!newMemberGroup) {
      ctx.logger.error({
        message: '[CRITICAL]: Missing internal group',
        organisationId,
        userId,
        targetRole,
      });

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'New member group not found',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.organisationGroupMember.delete({
        where: {
          organisationMemberId_groupId: {
            organisationMemberId: member.id,
            groupId: currentMemberGroup.id,
          },
        },
      });

      await tx.organisationGroupMember.create({
        data: {
          id: generateDatabaseId('group_member'),
          organisationMemberId: member.id,
          groupId: newMemberGroup.id,
        },
      });
    });
  },

  'admin.claims.find': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { query, page, perPage } = ZFindSubscriptionClaimsRequestSchema.parse(raw);

    return await findSubscriptionClaims({ query, page, perPage });
  },

  'admin.claims.create': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const input = ZCreateSubscriptionClaimRequestSchema.parse(raw);
    const { name, teamCount, memberCount, envelopeItemCount, flags } = input;

    ctx.logger.info({
      input,
    });

    await prisma.subscriptionClaim.create({
      data: {
        name,
        teamCount,
        envelopeItemCount,
        memberCount,
        flags,
      },
    });
  },

  'admin.claims.update': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const input = ZUpdateSubscriptionClaimRequestSchema.parse(raw);
    const { id, data } = input;

    ctx.logger.info({
      input,
    });

    const existingClaim = await prisma.subscriptionClaim.findUnique({
      where: { id },
    });

    if (!existingClaim) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Subscription claim not found' });
    }

    const newlyEnabledFlags = getNewTruthyFlags(existingClaim.flags, data.flags);

    await prisma.$transaction(async (tx) => {
      await tx.subscriptionClaim.update({
        where: {
          id,
        },
        data,
      });

      if (Object.keys(newlyEnabledFlags).length > 0) {
        await jobsClient.triggerJob({
          name: 'internal.backport-subscription-claims',
          payload: {
            subscriptionClaimId: id,
            flags: newlyEnabledFlags,
          },
        });
      }
    });
  },

  'admin.claims.delete': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { id } = ZDeleteSubscriptionClaimRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        id,
      },
    });

    const existingClaim = await prisma.subscriptionClaim.findFirst({
      where: {
        id,
      },
    });

    if (!existingClaim) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Subscription claim not found' });
    }

    if (existingClaim.locked) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot delete locked subscription claim',
      });
    }

    await prisma.subscriptionClaim.delete({
      where: {
        id,
      },
    });
  },

  'admin.license.resync': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    ZResyncLicenseRequestSchema.parse(raw);

    const client = LicenseClient.getInstance();

    if (!client) {
      return;
    }

    await client.resync();
  },

  'admin.user.get': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { id } = ZGetUserRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        id,
      },
    });

    return await getUserById({ id });
  },

  'admin.user.update': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { id, name, email, roles } = ZUpdateUserRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        id,
        roles,
      },
    });

    await updateUser({ id, name, email, roles });
  },

  'admin.user.delete': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { id } = ZDeleteUserRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        id,
      },
    });

    await deleteUser({ id });
  },

  'admin.user.enable': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { id } = ZEnableUserRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        id,
      },
    });

    const user = await getUserById({ id }).catch(() => null);

    if (!user) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'User not found',
      });
    }

    await enableUser({ id });
  },

  'admin.user.disable': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { id } = ZDisableUserRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        id,
      },
    });

    const user = await getUserById({ id }).catch(() => null);

    if (!user) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'User not found',
      });
    }

    await disableUser({ id });
  },

  'admin.user.resetTwoFactor': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { userId } = ZResetTwoFactorRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        userId,
      },
    });

    return await resetTwoFactor({ userId });
  },

  'admin.user.findTeams': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { userId, query, page = 1, perPage = 10 } = ZFindUserTeamsRequestSchema.parse(raw);

    const whereClause: Prisma.TeamWhereInput = {
      teamGroups: {
        some: {
          organisationGroup: {
            organisationGroupMembers: {
              some: {
                organisationMember: {
                  userId,
                },
              },
            },
          },
        },
      },
    };

    if (query && query.length > 0) {
      whereClause.name = {
        contains: query,
      };
    }

    const [data, count] = await Promise.all([
      prisma.team.findMany({
        where: whereClause,
        skip: Math.max(page - 1, 0) * perPage,
        take: perPage,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          organisation: {
            select: {
              id: true,
              name: true,
              url: true,
            },
          },
          teamGroups: {
            where: {
              organisationGroup: {
                organisationGroupMembers: {
                  some: {
                    organisationMember: {
                      userId,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.team.count({
        where: whereClause,
      }),
    ]);

    const mappedData = data.map((team) => ({
      id: team.id,
      name: team.name,
      url: team.url,
      createdAt: team.createdAt,
      teamRole: getHighestTeamRoleInGroup(team.teamGroups),
      organisation: team.organisation,
    }));

    return {
      data: mappedData,
      count,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: Math.ceil(count / perPage),
    } satisfies FindResultResponse<typeof mappedData>;
  },

  'admin.document.find': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { query, page, perPage } = ZFindDocumentsRequestSchema.parse(raw);

    const result = await adminFindDocuments({ query, page, perPage });

    return {
      ...result,
      data: result.data.map(mapEnvelopesToDocumentMany),
    };
  },

  'admin.document.findUnsealed': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { page, perPage } = ZFindUnsealedDocumentsRequestSchema.parse(raw);

    return await adminFindUnsealedDocuments({ page, perPage });
  },

  'admin.document.delete': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { id, reason } = ZDeleteDocumentRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        id,
      },
    });

    await sendDeleteEmail({ envelopeId: id, reason });

    await adminSuperDeleteDocument({
      envelopeId: id,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  },

  'admin.document.reseal': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { id } = ZResealDocumentRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        id,
      },
    });

    const envelope = await unsafeGetEntireEnvelope({
      id: {
        type: 'envelopeId',
        id,
      },
      type: EnvelopeType.DOCUMENT,
    });

    const isResealing = isDocumentCompleted(envelope.status);

    await jobs.triggerJob({
      name: 'internal.seal-document',
      payload: {
        documentId: mapSecondaryIdToDocumentId(envelope.secondaryId),
        isResealing,
      },
    });
  },

  'admin.document.findJobs': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { envelopeId, page = 1, perPage = 5 } = ZFindDocumentJobsRequestSchema.parse(raw);

    const envelope = await prisma.envelope.findFirst({
      where: unsafeBuildEnvelopeIdQuery(
        {
          type: 'envelopeId',
          id: envelopeId,
        },
        EnvelopeType.DOCUMENT,
      ),
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    const [data, count] = await Promise.all([
      prisma.backgroundJob.findMany({
        where: {
          jobId: 'internal.seal-document',
          payload: {
            // SQLite Json filter uses a JSONPath string (`$.documentId`),
            // not Postgres' array form (`['documentId']`).
            path: '$.documentId',
            equals: mapSecondaryIdToDocumentId(envelope.secondaryId),
          },
        },
        skip: Math.max(page - 1, 0) * perPage,
        take: perPage,
        orderBy: {
          submittedAt: 'desc',
        },
      }),
      prisma.backgroundJob.count({
        where: {
          jobId: 'internal.seal-document',
          payload: {
            // SQLite Json filter uses a JSONPath string (`$.documentId`),
            // not Postgres' array form (`['documentId']`).
            path: '$.documentId',
            equals: mapSecondaryIdToDocumentId(envelope.secondaryId),
          },
        },
      }),
    ]);

    return {
      data,
      count,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: Math.ceil(count / perPage),
    } satisfies FindResultResponse<typeof data>;
  },

  'admin.document.findAuditLogs': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const {
      envelopeId,
      page = 1,
      perPage = 50,
      orderByColumn = 'createdAt',
      orderByDirection = 'desc',
    } = ZFindDocumentAuditLogsRequestSchema.parse(raw);

    const envelope = await prisma.envelope.findFirst({
      where: unsafeBuildEnvelopeIdQuery(
        {
          type: 'envelopeId',
          id: envelopeId,
        },
        EnvelopeType.DOCUMENT,
      ),
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    const [data, count] = await Promise.all([
      prisma.documentAuditLog.findMany({
        where: { envelopeId: envelope.id },
        skip: Math.max(page - 1, 0) * perPage,
        take: perPage,
        orderBy: {
          [orderByColumn]: orderByDirection,
        },
      }),
      prisma.documentAuditLog.count({
        where: { envelopeId: envelope.id },
      }),
    ]);

    const parsedData = data.map((auditLog) => parseDocumentAuditLogData(auditLog));

    return {
      data: parsedData,
      count,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: Math.ceil(count / perPage),
    } satisfies FindResultResponse<typeof parsedData>;
  },

  'admin.recipient.update': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { id, name, email } = ZUpdateRecipientRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        id,
      },
    });

    await updateRecipient({ id, name, email });
  },

  'admin.emailDomain.find': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { query, page = 1, perPage = 20, status } = ZFindEmailDomainsRequestSchema.parse(raw);

    const whereClause: Prisma.EmailDomainWhereInput = {};

    if (query) {
      whereClause.OR = [
        {
          domain: {
            contains: query,
          },
        },
        {
          organisation: {
            name: {
              contains: query,
            },
          },
        },
      ];
    }

    if (status) {
      whereClause.status = status;
    }

    const [data, count] = await Promise.all([
      prisma.emailDomain.findMany({
        where: whereClause,
        skip: Math.max(page - 1, 0) * perPage,
        take: perPage,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          domain: true,
          status: true,
          selector: true,
          createdAt: true,
          updatedAt: true,
          lastVerifiedAt: true,
          organisation: {
            select: {
              id: true,
              name: true,
              url: true,
            },
          },
          _count: {
            select: {
              emails: true,
            },
          },
        },
      }),
      prisma.emailDomain.count({
        where: whereClause,
      }),
    ]);

    return {
      data,
      count,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: Math.ceil(count / perPage),
    } satisfies FindResultResponse<typeof data>;
  },

  'admin.emailDomain.get': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { emailDomainId } = ZGetEmailDomainRequestSchema.parse(raw);

    const emailDomain = await prisma.emailDomain.findUnique({
      where: {
        id: emailDomainId,
      },
      omit: {
        privateKey: true,
      },
      include: {
        organisation: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
        emails: true,
      },
    });

    if (!emailDomain) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Email domain not found',
      });
    }

    return emailDomain;
  },

  'admin.emailDomain.reregister': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { emailDomainId } = ZReregisterEmailDomainRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        emailDomainId,
      },
    });

    await reregisterEmailDomain({ emailDomainId });
  },

  'admin.updateSiteSetting': async (ctx: ZapContext, raw) => {
    await assertAdmin(ctx);
    const { ...siteSetting } = ZUpdateSiteSettingRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        id: siteSetting.id,
      },
    });

    await upsertSiteSetting({
      ...siteSetting,
      userId: ctx.user.id,
    });
  },
};
