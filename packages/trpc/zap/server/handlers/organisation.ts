// esign ZAP handlers — organisation router (37/37 procedures).
//
// Verbatim tRPC procedure bodies rewired to (ctx, raw). Input is validated by
// the SAME Zod schema the tRPC procedure used; the server-only functions and
// per-route exported helpers (getOrganisation / getOrganisations /
// findOrganisationMembers / deleteOrganisationMembers / findOrganisationMemberInvites /
// resendOrganisationMemberInvitation / findOrganisationGroups / findOrganisationEmails /
// getOrganisationEmailDomain / findOrganisationEmailDomains /
// getOrganisationAuthenticationPortal / getOrganisationSession) are reused
// unchanged. Route keys mirror the tRPC nested router shape (see
// organisation-router.zap). The .meta() calls are dropped.
//
// Auth note: in tRPC, member.invite.accept / member.invite.decline used
// maybeAuthenticatedProcedure and authenticationPortal.linkAccount /
// declineLinkAccount used the unauthenticated `procedure`. Their bodies read
// only `input` (and, for linkAccount, ctx.metadata) — never ctx.user — so they
// port verbatim onto the authenticated ZapContext without behavioural change;
// the ZAP transport establishes auth once at connection, and these handlers
// simply don't depend on it.
import {
  OrganisationGroupType,
  OrganisationMemberInviteStatus,
  OrganisationType,
  Prisma,
} from '@prisma/client';
import { unique } from 'remeda';

import { SIGN_ENCRYPTION_KEY } from '@hanzo/esign-lib/constants/crypto';
import {
  ORGANISATION_ACCOUNT_LINK_VERIFICATION_TOKEN_IDENTIFIER,
  ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP,
  ORGANISATION_USER_ACCOUNT_TYPE,
} from '@hanzo/esign-lib/constants/organisations';
import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { jobs } from '@hanzo/esign-lib/jobs/client';
import { createEmailDomain } from '@hanzo/esign-lib/server-only/email-domain/create-email-domain';
import { deleteEmailDomain } from '@hanzo/esign-lib/server-only/email-domain/delete-email-domain';
import { verifyEmailDomain } from '@hanzo/esign-lib/server-only/email-domain/verify-email-domain';
import { orphanEnvelopes } from '@hanzo/esign-lib/server-only/envelope/orphan-envelopes';
import { acceptOrganisationInvitation } from '@hanzo/esign-lib/server-only/organisation/accept-organisation-invitation';
import { createOrganisation } from '@hanzo/esign-lib/server-only/organisation/create-organisation';
import { createOrganisationMemberInvites } from '@hanzo/esign-lib/server-only/organisation/create-organisation-member-invites';
import { linkOrganisationAccount } from '@hanzo/esign-lib/server-only/organisation/link-organisation-account';
import { assertRateLimit } from '@hanzo/esign-lib/server-only/rate-limit/rate-limit-middleware';
import { linkOrgAccountRateLimit } from '@hanzo/esign-lib/server-only/rate-limit/rate-limits';
import { getMemberOrganisationRole } from '@hanzo/esign-lib/server-only/team/get-member-roles';
import { INTERNAL_CLAIM_ID, internalClaims } from '@hanzo/esign-lib/types/subscription';
import { symmetricEncrypt } from '@hanzo/esign-lib/universal/crypto';
import { generateDatabaseId } from '@hanzo/esign-lib/universal/id';
import {
  buildOrganisationWhereQuery,
  getHighestOrganisationRoleInGroup,
  isOrganisationRoleWithinUserHierarchy,
} from '@hanzo/esign-lib/utils/organisations';
import {
  buildTeamWhereQuery,
  extractDerivedTeamSettings,
  getHighestTeamRoleInGroup,
} from '@hanzo/esign-lib/utils/teams';
import { prisma } from '@hanzo/esign-prisma';

import { ZAcceptOrganisationMemberInviteRequestSchema } from '../../../server/organisation-router/accept-organisation-member-invite.types';
import { ZCreateOrganisationEmailDomainRequestSchema } from '../../../server/organisation-router/create-organisation-email-domain.types';
import { ZCreateOrganisationEmailRequestSchema } from '../../../server/organisation-router/create-organisation-email.types';
import { ZCreateOrganisationGroupRequestSchema } from '../../../server/organisation-router/create-organisation-group.types';
import { ZCreateOrganisationMemberInvitesRequestSchema } from '../../../server/organisation-router/create-organisation-member-invites.types';
import { ZCreateOrganisationRequestSchema } from '../../../server/organisation-router/create-organisation.types';
import { ZDeclineLinkOrganisationAccountRequestSchema } from '../../../server/organisation-router/decline-link-organisation-account.types';
import { ZDeclineOrganisationMemberInviteRequestSchema } from '../../../server/organisation-router/decline-organisation-member-invite.types';
import { ZDeleteOrganisationEmailDomainRequestSchema } from '../../../server/organisation-router/delete-organisation-email-domain.types';
import { ZDeleteOrganisationEmailRequestSchema } from '../../../server/organisation-router/delete-organisation-email.types';
import { ZDeleteOrganisationGroupRequestSchema } from '../../../server/organisation-router/delete-organisation-group.types';
import { ZDeleteOrganisationMemberInvitesRequestSchema } from '../../../server/organisation-router/delete-organisation-member-invites.types';
import { ZDeleteOrganisationMemberRequestSchema } from '../../../server/organisation-router/delete-organisation-member.types';
import { deleteOrganisationMembers } from '../../../server/organisation-router/delete-organisation-members';
import { ZDeleteOrganisationMembersRequestSchema } from '../../../server/organisation-router/delete-organisation-members.types';
import { ZDeleteOrganisationRequestSchema } from '../../../server/organisation-router/delete-organisation.types';
import { findOrganisationEmailDomains } from '../../../server/organisation-router/find-organisation-email-domain';
import { ZFindOrganisationEmailDomainsRequestSchema } from '../../../server/organisation-router/find-organisation-email-domain.types';
import { findOrganisationEmails } from '../../../server/organisation-router/find-organisation-emails';
import { ZFindOrganisationEmailsRequestSchema } from '../../../server/organisation-router/find-organisation-emails.types';
import { findOrganisationGroups } from '../../../server/organisation-router/find-organisation-groups';
import { ZFindOrganisationGroupsRequestSchema } from '../../../server/organisation-router/find-organisation-groups.types';
import { findOrganisationMemberInvites } from '../../../server/organisation-router/find-organisation-member-invites';
import { ZFindOrganisationMemberInvitesRequestSchema } from '../../../server/organisation-router/find-organisation-member-invites.types';
import { findOrganisationMembers } from '../../../server/organisation-router/find-organisation-members';
import { ZFindOrganisationMembersRequestSchema } from '../../../server/organisation-router/find-organisation-members.types';
import { getOrganisation } from '../../../server/organisation-router/get-organisation';
import { getOrganisationAuthenticationPortal } from '../../../server/organisation-router/get-organisation-authentication-portal';
import { ZGetOrganisationAuthenticationPortalRequestSchema } from '../../../server/organisation-router/get-organisation-authentication-portal.types';
import { getOrganisationEmailDomain } from '../../../server/organisation-router/get-organisation-email-domain';
import { ZGetOrganisationEmailDomainRequestSchema } from '../../../server/organisation-router/get-organisation-email-domain.types';
import { ZGetOrganisationMemberInvitesRequestSchema } from '../../../server/organisation-router/get-organisation-member-invites.types';
import { getOrganisationSession } from '../../../server/organisation-router/get-organisation-session';
import { ZGetOrganisationRequestSchema } from '../../../server/organisation-router/get-organisation.types';
import { getOrganisations } from '../../../server/organisation-router/get-organisations';
import { ZLeaveOrganisationRequestSchema } from '../../../server/organisation-router/leave-organisation.types';
import { ZLinkOrganisationAccountRequestSchema } from '../../../server/organisation-router/link-organisation-account.types';
import { resendOrganisationMemberInvitation } from '../../../server/organisation-router/resend-organisation-member-invite';
import { ZResendOrganisationMemberInviteRequestSchema } from '../../../server/organisation-router/resend-organisation-member-invite.types';
import { ZUpdateOrganisationAuthenticationPortalRequestSchema } from '../../../server/organisation-router/update-organisation-authentication-portal.types';
import { ZUpdateOrganisationEmailRequestSchema } from '../../../server/organisation-router/update-organisation-email.types';
import { ZUpdateOrganisationGroupRequestSchema } from '../../../server/organisation-router/update-organisation-group.types';
import { ZUpdateOrganisationMemberRequestSchema } from '../../../server/organisation-router/update-organisation-members.types';
import { ZUpdateOrganisationSettingsRequestSchema } from '../../../server/organisation-router/update-organisation-settings.types';
import { ZUpdateOrganisationRequestSchema } from '../../../server/organisation-router/update-organisation.types';
import { ZVerifyOrganisationEmailDomainRequestSchema } from '../../../server/organisation-router/verify-organisation-email-domain.types';
import type { ZapContext } from '../context';
import type { ZapRouteMap } from '../dispatch';

export const organisationRoutes: ZapRouteMap = {
  'organisation.get': async (ctx: ZapContext, raw) => {
    const { organisationReference } = ZGetOrganisationRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        organisationReference,
      },
    });

    return await getOrganisation({
      userId: ctx.user.id,
      organisationReference,
    });
  },

  'organisation.getMany': async (ctx: ZapContext) => {
    const { user } = ctx;

    return getOrganisations({ userId: user.id });
  },

  'organisation.create': async (ctx: ZapContext, raw) => {
    const { name } = ZCreateOrganisationRequestSchema.parse(raw);
    const { user } = ctx;

    await createOrganisation({
      userId: user.id,
      name,
      type: OrganisationType.ORGANISATION,
      claim: internalClaims[INTERNAL_CLAIM_ID.FREE],
    });

    return {
      paymentRequired: false,
    };
  },

  'organisation.update': async (ctx: ZapContext, raw) => {
    const { organisationId, data } = ZUpdateOrganisationRequestSchema.parse(raw);
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    // Check if organisation exists and user has access to it
    const existingOrganisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    if (!existingOrganisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation not found',
      });
    }

    await prisma.organisation.update({
      where: {
        id: organisationId,
      },
      data: {
        name: data.name,
        url: data.url,
      },
    });
  },

  'organisation.delete': async (ctx: ZapContext, raw) => {
    const { organisationId } = ZDeleteOrganisationRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['DELETE_ORGANISATION'],
      }),
      select: {
        id: true,
        owner: {
          select: {
            id: true,
          },
        },
        teams: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not authorized to delete this organisation',
      });
    }

    // Orphan all envelopes to get rid of foreign key constraints.
    await Promise.all(organisation.teams.map(async (team) => orphanEnvelopes({ teamId: team.id })));

    await prisma.$transaction(async (tx) => {
      await tx.account.deleteMany({
        where: {
          type: ORGANISATION_USER_ACCOUNT_TYPE,
          provider: organisation.id,
        },
      });

      await tx.organisation.delete({
        where: {
          id: organisation.id,
        },
      });
    });
  },

  'organisation.leave': async (ctx: ZapContext, raw) => {
    const { organisationId } = ZLeaveOrganisationRequestSchema.parse(raw);
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({ organisationId, userId }),
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    await prisma.organisationMember.delete({
      where: {
        userId_organisationId: {
          userId,
          organisationId,
        },
      },
    });

    await jobs.triggerJob({
      name: 'send.organisation-member-left.email',
      payload: {
        organisationId: organisation.id,
        memberUserId: userId,
      },
    });
  },

  'organisation.member.find': async (ctx: ZapContext, raw) => {
    const input = ZFindOrganisationMembersRequestSchema.parse(raw);
    const { organisationId } = input;
    const { id } = ctx.user;

    const organisationMembers = await findOrganisationMembers({
      userId: id,
      organisationId,
      query: input.query,
      page: input.page,
      perPage: input.perPage,
    });

    return {
      ...organisationMembers,
      data: organisationMembers.data.map((organisationMember) => {
        const groups = organisationMember.organisationGroupMembers.map((group) => group.group);

        return {
          id: organisationMember.id,
          userId: organisationMember.user.id,
          email: organisationMember.user.email,
          name: organisationMember.user.name || '',
          createdAt: organisationMember.createdAt,
          currentOrganisationRole: getHighestOrganisationRoleInGroup(groups),
          avatarImageId: organisationMember.user.avatarImageId,
          groups,
        };
      }),
    };
  },

  'organisation.member.update': async (ctx: ZapContext, raw) => {
    const { organisationId, organisationMemberId, data } =
      ZUpdateOrganisationMemberRequestSchema.parse(raw);
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        organisationId,
        organisationMemberId,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
      include: {
        groups: {
          where: {
            type: OrganisationGroupType.INTERNAL_ORGANISATION,
          },
        },
        members: {
          include: {
            organisationGroupMembers: {
              include: {
                group: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Organisation not found' });
    }

    const currentUser = organisation.members.find((member) => member.userId === userId);

    const organisationMemberToUpdate = organisation.members.find(
      (member) => member.id === organisationMemberId,
    );

    if (!organisationMemberToUpdate || !currentUser) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Organisation member does not exist' });
    }

    if (organisationMemberToUpdate.userId === organisation.ownerUserId) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'Cannot update the owner' });
    }

    const currentUserOrganisationRoles = currentUser.organisationGroupMembers.filter(
      ({ group }) => group.type === OrganisationGroupType.INTERNAL_ORGANISATION,
    );

    if (currentUserOrganisationRoles.length !== 1) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Current user has multiple internal organisation roles',
      });
    }

    const currentUserOrganisationRole = currentUserOrganisationRoles[0].group.organisationRole;
    const currentMemberToUpdateOrganisationRole = getHighestOrganisationRoleInGroup(
      organisationMemberToUpdate.organisationGroupMembers.flatMap((member) => member.group),
    );

    const isMemberToUpdateHigherRole = !isOrganisationRoleWithinUserHierarchy(
      currentUserOrganisationRole,
      currentMemberToUpdateOrganisationRole,
    );

    if (isMemberToUpdateHigherRole) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot update a member with a higher role',
      });
    }

    const isNewMemberRoleHigherThanCurrentRole = !isOrganisationRoleWithinUserHierarchy(
      currentUserOrganisationRole,
      data.role,
    );

    if (isNewMemberRoleHigherThanCurrentRole) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot give a member a role higher than the user initating the update',
      });
    }

    const currentMemberGroup = organisation.groups.find(
      (group) => group.organisationRole === currentMemberToUpdateOrganisationRole,
    );

    const newMemberGroup = organisation.groups.find(
      (group) => group.organisationRole === data.role,
    );

    if (!currentMemberGroup) {
      console.error('[CRITICAL]: Missing internal group');

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Current member group not found',
      });
    }

    if (!newMemberGroup) {
      console.error('[CRITICAL]: Missing internal group');

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'New member group not found',
      });
    }

    // Switch member to new internal group role.
    await prisma.$transaction(async (tx) => {
      await tx.organisationGroupMember.delete({
        where: {
          organisationMemberId_groupId: {
            organisationMemberId: organisationMemberToUpdate.id,
            groupId: currentMemberGroup.id,
          },
        },
      });

      await tx.organisationGroupMember.create({
        data: {
          id: generateDatabaseId('group_member'),
          organisationMemberId: organisationMemberToUpdate.id,
          groupId: newMemberGroup.id,
        },
      });
    });
  },

  'organisation.member.delete': async (ctx: ZapContext, raw) => {
    const { organisationId, organisationMemberId } =
      ZDeleteOrganisationMemberRequestSchema.parse(raw);
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        organisationId,
        organisationMemberId,
      },
    });

    await deleteOrganisationMembers({
      userId,
      organisationId,
      organisationMemberIds: [organisationMemberId],
    });
  },

  'organisation.member.deleteMany': async (ctx: ZapContext, raw) => {
    const { organisationId, organisationMemberIds } =
      ZDeleteOrganisationMembersRequestSchema.parse(raw);
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        organisationId,
        organisationMemberIds,
      },
    });

    await deleteOrganisationMembers({
      userId,
      organisationId,
      organisationMemberIds,
    });
  },

  'organisation.member.invite.find': async (ctx: ZapContext, raw) => {
    const { organisationId, query, page, perPage, status } =
      ZFindOrganisationMemberInvitesRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    return await findOrganisationMemberInvites({
      userId: user.id,
      organisationId,
      query,
      page,
      perPage,
      status,
    });
  },

  'organisation.member.invite.getMany': async (ctx: ZapContext, raw) => {
    const { user } = ctx;

    const { status } = ZGetOrganisationMemberInvitesRequestSchema.parse(raw);

    return await prisma.organisationMemberInvite.findMany({
      where: {
        email: user.email,
        status,
      },
      include: {
        organisation: {
          select: {
            id: true,
            name: true,
            url: true,
            avatarImageId: true,
          },
        },
      },
    });
  },

  'organisation.member.invite.createMany': async (ctx: ZapContext, raw) => {
    const { organisationId, invitations } =
      ZCreateOrganisationMemberInvitesRequestSchema.parse(raw);
    const userId = ctx.user.id;
    const userName = ctx.user.name || '';

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    await createOrganisationMemberInvites({
      userId,
      userName,
      organisationId,
      invitations,
    });
  },

  'organisation.member.invite.deleteMany': async (ctx: ZapContext, raw) => {
    const { organisationId, invitationIds } =
      ZDeleteOrganisationMemberInvitesRequestSchema.parse(raw);
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        organisationId,
        invitationIds,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    await prisma.organisationMemberInvite.deleteMany({
      where: {
        id: {
          in: invitationIds,
        },
        organisationId,
      },
    });
  },

  'organisation.member.invite.accept': async (_ctx: ZapContext, raw) => {
    const { token } = ZAcceptOrganisationMemberInviteRequestSchema.parse(raw);

    return await acceptOrganisationInvitation({
      token,
    });
  },

  'organisation.member.invite.decline': async (_ctx: ZapContext, raw) => {
    const { token } = ZDeclineOrganisationMemberInviteRequestSchema.parse(raw);

    const organisationMemberInvite = await prisma.organisationMemberInvite.findFirst({
      where: {
        token,
      },
    });

    if (!organisationMemberInvite) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    await prisma.organisationMemberInvite.update({
      where: {
        id: organisationMemberInvite.id,
      },
      data: {
        status: OrganisationMemberInviteStatus.DECLINED,
      },
    });

    // TODO: notify the team owner
  },

  'organisation.member.invite.resend': async (ctx: ZapContext, raw) => {
    const { organisationId, invitationId } =
      ZResendOrganisationMemberInviteRequestSchema.parse(raw);

    const userId = ctx.user.id;
    const userName = ctx.user.name || '';

    ctx.logger.info({
      input: {
        organisationId,
        invitationId,
      },
    });

    await resendOrganisationMemberInvitation({
      userId,
      userName,
      organisationId,
      invitationId,
    });
  },

  'organisation.group.find': async (ctx: ZapContext, raw) => {
    const { organisationId, types, query, page, perPage, organisationGroupId, organisationRoles } =
      ZFindOrganisationGroupsRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    return await findOrganisationGroups({
      userId: user.id,
      organisationId,
      organisationGroupId,
      organisationRoles,
      types,
      query,
      page,
      perPage,
    });
  },

  'organisation.group.create': async (ctx: ZapContext, raw) => {
    const { organisationId, organisationRole, name, memberIds } =
      ZCreateOrganisationGroupRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
      include: {
        groups: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    const currentUserOrganisationRole = await getMemberOrganisationRole({
      organisationId,
      reference: {
        type: 'User',
        id: user.id,
      },
    });

    if (!isOrganisationRoleWithinUserHierarchy(currentUserOrganisationRole, organisationRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to create this organisation group',
      });
    }

    // Validate that members exist in the organisation.
    memberIds.forEach((memberId) => {
      const member = organisation.members.find(({ id }) => id === memberId);

      if (!member) {
        throw new AppError(AppErrorCode.NOT_FOUND);
      }
    });

    await prisma.$transaction(async (tx) => {
      const group = await tx.organisationGroup.create({
        data: {
          id: generateDatabaseId('org_group'),
          organisationId,
          name,
          type: OrganisationGroupType.CUSTOM,
          organisationRole,
        },
      });

      await tx.organisationGroupMember.createMany({
        data: memberIds.map((memberId) => ({
          id: generateDatabaseId('group_member'),
          organisationMemberId: memberId,
          groupId: group.id,
        })),
      });

      return group;
    });
  },

  'organisation.group.update': async (ctx: ZapContext, raw) => {
    const { id, ...data } = ZUpdateOrganisationGroupRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        id,
      },
    });

    const organisationGroup = await prisma.organisationGroup.findFirst({
      where: {
        id,
        organisation: buildOrganisationWhereQuery({
          organisationId: undefined,
          userId: user.id,
          roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
        }),
      },
      include: {
        organisationGroupMembers: true,
      },
    });

    if (!organisationGroup) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation group not found',
      });
    }

    if (organisationGroup.type === OrganisationGroupType.INTERNAL_ORGANISATION) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to update internal organisation groups',
      });
    }

    const currentUserOrganisationRole = await getMemberOrganisationRole({
      organisationId: organisationGroup.organisationId,
      reference: {
        type: 'User',
        id: user.id,
      },
    });

    if (
      !isOrganisationRoleWithinUserHierarchy(
        currentUserOrganisationRole,
        organisationGroup.organisationRole,
      )
    ) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to update this organisation group',
      });
    }

    if (
      data.organisationRole &&
      !isOrganisationRoleWithinUserHierarchy(currentUserOrganisationRole, data.organisationRole)
    ) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to set an organisation role higher than your own',
      });
    }

    const groupMemberIds = unique(data.memberIds || []);

    const membersToDelete = organisationGroup.organisationGroupMembers.filter(
      (member) => !groupMemberIds.includes(member.organisationMemberId),
    );

    const membersToCreate = groupMemberIds.filter(
      (id) =>
        !organisationGroup.organisationGroupMembers.some(
          (member) => member.organisationMemberId === id,
        ),
    );

    await prisma.$transaction(async (tx) => {
      await tx.organisationGroup.update({
        where: {
          id,
        },
        data: {
          organisationRole: data.organisationRole,
          name: data.name,
        },
      });

      // Only run deletion if memberIds is defined.
      if (data.memberIds && membersToDelete.length > 0) {
        await tx.organisationGroupMember.deleteMany({
          where: {
            groupId: organisationGroup.id,
            organisationMemberId: { in: membersToDelete.map((m) => m.organisationMemberId) },
          },
        });
      }

      // Only run creation if memberIds is defined.
      if (data.memberIds && membersToCreate.length > 0) {
        await tx.organisationGroupMember.createMany({
          data: membersToCreate.map((id) => ({
            id: generateDatabaseId('group_member'),
            groupId: organisationGroup.id,
            organisationMemberId: id,
          })),
        });
      }
    });
  },

  'organisation.group.delete': async (ctx: ZapContext, raw) => {
    const { groupId, organisationId } = ZDeleteOrganisationGroupRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        groupId,
        organisationId,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    const group = await prisma.organisationGroup.findFirst({
      where: {
        id: groupId,
        organisationId,
      },
    });

    if (!group) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation group not found',
      });
    }

    if (
      group.type === OrganisationGroupType.INTERNAL_ORGANISATION ||
      group.type === OrganisationGroupType.INTERNAL_TEAM
    ) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to delete internal groups',
      });
    }

    await prisma.organisationGroup.delete({
      where: {
        id: groupId,
        organisationId: organisation.id,
      },
    });
  },

  'organisation.settings.update': async (ctx: ZapContext, raw) => {
    const { user } = ctx;
    const { organisationId, data } = ZUpdateOrganisationSettingsRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const {
      // Document related settings.
      documentVisibility,
      documentLanguage,
      documentTimezone,
      documentDateFormat,
      includeSenderDetails,
      includeSigningCertificate,
      includeAuditLog,
      typedSignatureEnabled,
      uploadSignatureEnabled,
      drawSignatureEnabled,
      defaultRecipients,
      delegateDocumentOwnership,
      envelopeExpirationPeriod,

      // Branding related settings.
      brandingEnabled,
      brandingLogo,
      brandingUrl,
      brandingCompanyDetails,

      // Email related settings.
      emailId,
      emailReplyTo,
      // emailReplyToName,
      emailDocumentSettings,

      // AI features settings.
      aiFeaturesEnabled,
    } = data;

    if (Object.values(data).length === 0) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'No settings to update',
      });
    }

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
      include: {
        organisationGlobalSettings: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to update this organisation.',
      });
    }

    // Validate that the email ID belongs to the organisation.
    if (emailId) {
      const email = await prisma.organisationEmail.findFirst({
        where: {
          id: emailId,
          organisationId,
        },
      });

      if (!email) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Email not found',
        });
      }
    }

    const derivedTypedSignatureEnabled =
      typedSignatureEnabled ?? organisation.organisationGlobalSettings.typedSignatureEnabled;
    const derivedUploadSignatureEnabled =
      uploadSignatureEnabled ?? organisation.organisationGlobalSettings.uploadSignatureEnabled;
    const derivedDrawSignatureEnabled =
      drawSignatureEnabled ?? organisation.organisationGlobalSettings.drawSignatureEnabled;

    const derivedDelegateDocumentOwnership =
      delegateDocumentOwnership ??
      organisation.organisationGlobalSettings.delegateDocumentOwnership;

    if (
      derivedTypedSignatureEnabled === false &&
      derivedUploadSignatureEnabled === false &&
      derivedDrawSignatureEnabled === false
    ) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'At least one signature type must be enabled',
      });
    }

    const isPersonalOrganisation = organisation.type === OrganisationType.PERSONAL;
    const currentIncludeSenderDetails =
      organisation.organisationGlobalSettings.includeSenderDetails;

    const isChangingIncludeSenderDetails =
      includeSenderDetails !== undefined && includeSenderDetails !== currentIncludeSenderDetails;

    if (isPersonalOrganisation && isChangingIncludeSenderDetails) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Personal organisations cannot update the sender details',
      });
    }

    await prisma.organisation.update({
      where: {
        id: organisationId,
      },
      data: {
        organisationGlobalSettings: {
          update: {
            // Document related settings.
            documentVisibility,
            documentLanguage,
            documentTimezone,
            documentDateFormat,
            includeSenderDetails,
            includeSigningCertificate,
            includeAuditLog,
            typedSignatureEnabled,
            uploadSignatureEnabled,
            drawSignatureEnabled,
            defaultRecipients: defaultRecipients === null ? Prisma.DbNull : defaultRecipients,
            delegateDocumentOwnership: derivedDelegateDocumentOwnership,
            envelopeExpirationPeriod:
              envelopeExpirationPeriod === null ? Prisma.DbNull : envelopeExpirationPeriod,

            // Branding related settings.
            brandingEnabled,
            brandingLogo,
            brandingUrl,
            brandingCompanyDetails,

            // Email related settings.
            emailId,
            emailReplyTo,
            // emailReplyToName,
            emailDocumentSettings,

            // AI features settings.
            aiFeaturesEnabled,
          },
        },
      },
    });
  },

  'organisation.email.find': async (ctx: ZapContext, raw) => {
    const { organisationId, emailDomainId, query, page, perPage } =
      ZFindOrganisationEmailsRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    return await findOrganisationEmails({
      userId: user.id,
      organisationId,
      emailDomainId,
      query,
      page,
      perPage,
    });
  },

  'organisation.email.create': async (ctx: ZapContext, raw) => {
    const { email, emailName, emailDomainId } = ZCreateOrganisationEmailRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        emailDomainId,
      },
    });

    const emailDomain = await prisma.emailDomain.findFirst({
      where: {
        id: emailDomainId,
        organisation: buildOrganisationWhereQuery({
          organisationId: undefined,
          userId: user.id,
          roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
        }),
      },
    });

    if (!emailDomain) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Email domain not found',
      });
    }

    const allowedEmailSuffix = '@' + emailDomain.domain;

    if (!email.endsWith(allowedEmailSuffix)) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Cannot create an email with a different domain',
      });
    }

    await prisma.organisationEmail.create({
      data: {
        id: generateDatabaseId('org_email'),
        organisationId: emailDomain.organisationId,
        emailName,
        // replyTo,
        email,
        emailDomainId,
      },
    });
  },

  'organisation.email.update': async (ctx: ZapContext, raw) => {
    const { emailId, emailName } = ZUpdateOrganisationEmailRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        emailId,
      },
    });

    const organisationEmail = await prisma.organisationEmail.findFirst({
      where: {
        id: emailId,
        organisation: buildOrganisationWhereQuery({
          organisationId: undefined,
          userId: user.id,
          roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
        }),
      },
    });

    if (!organisationEmail) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    await prisma.organisationEmail.update({
      where: {
        id: emailId,
      },
      data: {
        emailName,
        // replyTo,
      },
    });
  },

  'organisation.email.delete': async (ctx: ZapContext, raw) => {
    const { emailId } = ZDeleteOrganisationEmailRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        emailId,
      },
    });

    const email = await prisma.organisationEmail.findFirst({
      where: {
        id: emailId,
        organisation: buildOrganisationWhereQuery({
          organisationId: undefined,
          userId: user.id,
          roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
        }),
      },
    });

    if (!email) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    await prisma.organisationEmail.delete({
      where: {
        id: email.id,
      },
    });
  },

  'organisation.emailDomain.get': async (ctx: ZapContext, raw) => {
    const { emailDomainId } = ZGetOrganisationEmailDomainRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        emailDomainId,
      },
    });

    return await getOrganisationEmailDomain({
      userId: ctx.user.id,
      emailDomainId,
    });
  },

  'organisation.emailDomain.find': async (ctx: ZapContext, raw) => {
    const { organisationId, emailDomainId, statuses, query, page, perPage } =
      ZFindOrganisationEmailDomainsRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    return await findOrganisationEmailDomains({
      userId: user.id,
      organisationId,
      emailDomainId,
      statuses,
      query,
      page,
      perPage,
    });
  },

  'organisation.emailDomain.create': async (ctx: ZapContext, raw) => {
    const { organisationId, domain } = ZCreateOrganisationEmailDomainRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
        domain,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
      include: {
        emailDomains: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    if (organisation.emailDomains.length >= 100) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'You have reached the maximum number of email domains',
      });
    }

    return await createEmailDomain({
      domain,
      organisationId,
    });
  },

  'organisation.emailDomain.delete': async (ctx: ZapContext, raw) => {
    const { emailDomainId } = ZDeleteOrganisationEmailDomainRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        emailDomainId,
      },
    });

    const emailDomain = await prisma.emailDomain.findFirst({
      where: {
        id: emailDomainId,
        organisation: buildOrganisationWhereQuery({
          organisationId: undefined,
          userId: user.id,
          roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
        }),
      },
    });

    if (!emailDomain) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Email domain not found',
      });
    }

    await deleteEmailDomain({
      emailDomainId: emailDomain.id,
    });
  },

  'organisation.emailDomain.verify': async (ctx: ZapContext, raw) => {
    const { organisationId, emailDomainId } =
      ZVerifyOrganisationEmailDomainRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
        emailDomainId,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
      include: {
        emailDomains: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    // Filter down emails to verify a specific email, otherwise verify all emails regardless of status.
    const emailsToVerify = organisation.emailDomains.filter((email) => {
      if (emailDomainId && email.id !== emailDomainId) {
        return false;
      }

      return true;
    });

    await Promise.all(emailsToVerify.map(async (email) => verifyEmailDomain(email.id)));
  },

  'organisation.authenticationPortal.get': async (ctx: ZapContext, raw) => {
    const { organisationId } = ZGetOrganisationAuthenticationPortalRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    return await getOrganisationAuthenticationPortal({
      userId: ctx.user.id,
      organisationId,
    });
  },

  'organisation.authenticationPortal.update': async (ctx: ZapContext, raw) => {
    const { organisationId, data } =
      ZUpdateOrganisationAuthenticationPortalRequestSchema.parse(raw);
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
      include: {
        organisationAuthenticationPortal: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    const {
      defaultOrganisationRole,
      enabled,
      clientId,
      clientSecret,
      wellKnownUrl,
      autoProvisionUsers,
      allowedDomains,
    } = data;

    if (
      enabled &&
      (!wellKnownUrl ||
        !clientId ||
        (!clientSecret && !organisation.organisationAuthenticationPortal.clientSecret))
    ) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message:
          'Client ID, client secret, and well known URL are required when authentication portal is enabled',
      });
    }

    // Allow empty string to be passed in to remove the client secret from the database.
    let encryptedClientSecret: string | undefined = clientSecret;

    // Encrypt the secret if it is provided.
    if (clientSecret) {
      const encryptionKey = SIGN_ENCRYPTION_KEY;

      if (!encryptionKey) {
        throw new Error('Missing SIGN_ENCRYPTION_KEY');
      }

      encryptedClientSecret = symmetricEncrypt({
        key: encryptionKey,
        data: clientSecret,
      });
    }

    await prisma.organisationAuthenticationPortal.update({
      where: {
        id: organisation.organisationAuthenticationPortal.id,
      },
      data: {
        defaultOrganisationRole,
        enabled,
        clientId,
        clientSecret: encryptedClientSecret,
        wellKnownUrl,
        autoProvisionUsers,
        allowedDomains,
      },
    });
  },

  'organisation.authenticationPortal.linkAccount': async (ctx: ZapContext, raw) => {
    const { token } = ZLinkOrganisationAccountRequestSchema.parse(raw);

    const rateLimitResult = await linkOrgAccountRateLimit.check({
      ip: ctx.metadata.requestMetadata.ipAddress ?? 'unknown',
      identifier: token,
    });

    assertRateLimit(rateLimitResult);

    await linkOrganisationAccount({
      token,
      requestMeta: ctx.metadata.requestMetadata,
    });
  },

  'organisation.authenticationPortal.declineLinkAccount': async (_ctx: ZapContext, raw) => {
    const { token } = ZDeclineLinkOrganisationAccountRequestSchema.parse(raw);

    await prisma.verificationToken.delete({
      where: {
        token,
        identifier: ORGANISATION_ACCOUNT_LINK_VERIFICATION_TOKEN_IDENTIFIER,
      },
    });
  },

  'organisation.internal.getOrganisationSession': async (ctx: ZapContext) => {
    return await getOrganisationSession({ userId: ctx.user.id });
  },
};
