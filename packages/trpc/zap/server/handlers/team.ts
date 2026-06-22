// esign ZAP handlers — team router (21/21 procedures).
//
// Verbatim tRPC procedure bodies rewired to (ctx, raw). Input is validated by
// the SAME Zod schema the tRPC procedure used; server-only functions and the
// per-route exported helpers (createTeamMembers / findTeamGroups) are reused
// unchanged. Inline-bodied procedures (member.update/delete, group.*, settings)
// have their mutation body ported verbatim. Route keys mirror the tRPC nested
// router shape (see team-router.zap).
import { OrganisationGroupType, OrganisationMemberRole, TeamMemberRole } from '@prisma/client';
import { OrganisationType, Prisma } from '@prisma/client';
import { match } from 'ts-pattern';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@hanzo/esign-lib/constants/organisations';
import {
  ALLOWED_TEAM_GROUP_TYPES,
  TEAM_MEMBER_ROLE_PERMISSIONS_MAP,
} from '@hanzo/esign-lib/constants/teams';
import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { orphanEnvelopes } from '@hanzo/esign-lib/server-only/envelope/orphan-envelopes';
import { transferTeamEnvelopes } from '@hanzo/esign-lib/server-only/envelope/transfer-team-envelopes';
import { createTeam } from '@hanzo/esign-lib/server-only/team/create-team';
import { createTeamEmailVerification } from '@hanzo/esign-lib/server-only/team/create-team-email-verification';
import { deleteTeam } from '@hanzo/esign-lib/server-only/team/delete-team';
import { deleteTeamEmail } from '@hanzo/esign-lib/server-only/team/delete-team-email';
import { deleteTeamEmailVerification } from '@hanzo/esign-lib/server-only/team/delete-team-email-verification';
import { findTeamMembers } from '@hanzo/esign-lib/server-only/team/find-team-members';
import { findTeams } from '@hanzo/esign-lib/server-only/team/find-teams';
import { getMemberRoles } from '@hanzo/esign-lib/server-only/team/get-member-roles';
import { getTeam, getTeamById } from '@hanzo/esign-lib/server-only/team/get-team';
import { getTeamEmailByEmail } from '@hanzo/esign-lib/server-only/team/get-team-email-by-email';
import { getTeamMembers } from '@hanzo/esign-lib/server-only/team/get-team-members';
import { resendTeamEmailVerification } from '@hanzo/esign-lib/server-only/team/resend-team-email-verification';
import { updateTeam } from '@hanzo/esign-lib/server-only/team/update-team';
import { updateTeamEmail } from '@hanzo/esign-lib/server-only/team/update-team-email';
import { updateTeamPublicProfile } from '@hanzo/esign-lib/server-only/team/update-team-public-profile';
import { generateDatabaseId } from '@hanzo/esign-lib/universal/id';
import { buildOrganisationWhereQuery } from '@hanzo/esign-lib/utils/organisations';
import { buildTeamWhereQuery, isTeamRoleWithinUserHierarchy } from '@hanzo/esign-lib/utils/teams';
import { prisma } from '@hanzo/esign-prisma';

import { ZCreateTeamGroupsRequestSchema } from '../../../server/team-router/create-team-groups.types';
import { createTeamMembers } from '../../../server/team-router/create-team-members';
import { ZCreateTeamMembersRequestSchema } from '../../../server/team-router/create-team-members.types';
import { ZCreateTeamRequestSchema } from '../../../server/team-router/create-team.types';
import { ZDeleteTeamGroupRequestSchema } from '../../../server/team-router/delete-team-group.types';
import { ZDeleteTeamMemberRequestSchema } from '../../../server/team-router/delete-team-member.types';
import { ZDeleteTeamRequestSchema } from '../../../server/team-router/delete-team.types';
import { findTeamGroups } from '../../../server/team-router/find-team-groups';
import { ZFindTeamGroupsRequestSchema } from '../../../server/team-router/find-team-groups.types';
import { ZFindTeamMembersRequestSchema } from '../../../server/team-router/find-team-members.types';
import { ZFindTeamsRequestSchema } from '../../../server/team-router/find-teams.types';
import { ZGetTeamMembersRequestSchema } from '../../../server/team-router/get-team-members.types';
import { ZGetTeamRequestSchema } from '../../../server/team-router/get-team.types';
import {
  ZCreateTeamEmailVerificationMutationSchema,
  ZDeleteTeamEmailMutationSchema,
  ZDeleteTeamEmailVerificationMutationSchema,
  ZResendTeamEmailVerificationMutationSchema,
  ZUpdateTeamEmailMutationSchema,
} from '../../../server/team-router/schema';
import { ZUpdateTeamGroupRequestSchema } from '../../../server/team-router/update-team-group.types';
import { ZUpdateTeamMemberRequestSchema } from '../../../server/team-router/update-team-member.types';
import { ZUpdateTeamSettingsRequestSchema } from '../../../server/team-router/update-team-settings.types';
import { ZUpdateTeamRequestSchema } from '../../../server/team-router/update-team.types';
import type { ZapContext } from '../context';
import type { ZapRouteMap } from '../dispatch';

export const teamRoutes: ZapRouteMap = {
  'team.find': async (ctx: ZapContext, raw) => {
    const { organisationId } = ZFindTeamsRequestSchema.parse(raw);
    return findTeams({ userId: ctx.user.id, organisationId });
  },

  'team.get': async (ctx: ZapContext, raw) => {
    const { teamReference } = ZGetTeamRequestSchema.parse(raw);
    return await getTeam({ teamReference, userId: ctx.user.id });
  },

  'team.create': async (ctx: ZapContext, raw) => {
    const { teamName, teamUrl, organisationId, inheritMembers } =
      ZCreateTeamRequestSchema.parse(raw);
    return await createTeam({
      userId: ctx.user.id,
      teamName,
      teamUrl,
      organisationId,
      inheritMembers,
    });
  },

  'team.update': async (ctx: ZapContext, raw) => {
    const { teamId, data } = ZUpdateTeamRequestSchema.parse(raw);
    const { name, url, profileBio, profileEnabled } = data;

    if (name || url) {
      await updateTeam({ userId: ctx.user.id, teamId, data: { name, url } });
    }

    if (profileBio || profileEnabled !== undefined) {
      await updateTeamPublicProfile({
        userId: ctx.user.id,
        teamId,
        data: { bio: profileBio, enabled: profileEnabled },
      });
    }
  },

  'team.delete': async (ctx: ZapContext, raw) => {
    const { teamId, transferTeamId } = ZDeleteTeamRequestSchema.parse(raw);
    const { user } = ctx;

    const team = await getTeamById({ userId: user.id, teamId });

    if (team.currentTeamRole !== TeamMemberRole.ADMIN) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to delete this team',
      });
    }

    const transferTeam = transferTeamId
      ? await getTeamById({ userId: user.id, teamId: transferTeamId }).catch(() => {
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message: 'Invalid transfer team ID',
          });
        })
      : undefined;

    if (transferTeam) {
      await transferTeamEnvelopes({ sourceTeamId: teamId, targetTeamId: transferTeam.id });
    } else {
      await orphanEnvelopes({ teamId });
    }

    await deleteTeam({ userId: user.id, teamId });
  },

  'team.member.find': async (ctx: ZapContext, raw) => {
    const { teamId, query, page, perPage } = ZFindTeamMembersRequestSchema.parse(raw);
    return await findTeamMembers({ userId: ctx.user.id, teamId, query, page, perPage });
  },

  'team.member.getMany': async (ctx: ZapContext, raw) => {
    const { teamId } = ZGetTeamMembersRequestSchema.parse(raw);
    return await getTeamMembers({ userId: ctx.user.id, teamId });
  },

  'team.member.createMany': async (ctx: ZapContext, raw) => {
    const { teamId, organisationMembers } = ZCreateTeamMembersRequestSchema.parse(raw);
    return await createTeamMembers({
      userId: ctx.user.id,
      teamId,
      membersToCreate: organisationMembers,
    });
  },

  'team.member.update': async (ctx: ZapContext, raw) => {
    const { teamId, memberId, data } = ZUpdateTeamMemberRequestSchema.parse(raw);
    const userId = ctx.user.id;

    const team = await prisma.team.findFirst({
      where: {
        AND: [
          buildTeamWhereQuery({
            teamId,
            userId,
            roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
          }),
          { organisation: { members: { some: { id: memberId } } } },
        ],
      },
      include: {
        teamGroups: {
          where: { organisationGroup: { type: OrganisationGroupType.INTERNAL_TEAM } },
          include: {
            organisationGroup: {
              include: {
                organisationGroupMembers: { include: { organisationMember: true } },
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Team not found' });
    }

    const internalTeamGroupToRemoveMemberFrom = team.teamGroups.find(
      (group) =>
        group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
        group.teamId === teamId &&
        group.organisationGroup.organisationGroupMembers.some(
          (member) => member.organisationMemberId === memberId,
        ),
    );

    const teamMemberGroup = team.teamGroups.find(
      (group) =>
        group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
        group.teamId === teamId &&
        group.teamRole === TeamMemberRole.MEMBER,
    );

    const teamManagerGroup = team.teamGroups.find(
      (group) =>
        group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
        group.teamId === teamId &&
        group.teamRole === TeamMemberRole.MANAGER,
    );

    const teamAdminGroup = team.teamGroups.find(
      (group) =>
        group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
        group.teamId === teamId &&
        group.teamRole === TeamMemberRole.ADMIN,
    );

    if (!teamMemberGroup || !teamManagerGroup || !teamAdminGroup) {
      console.error({
        message: 'Team groups not found.',
        teamMemberGroup: Boolean(teamMemberGroup),
        teamManagerGroup: Boolean(teamManagerGroup),
        teamAdminGroup: Boolean(teamAdminGroup),
      });

      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Team groups not found.' });
    }

    const { teamRole: currentUserTeamRole } = await getMemberRoles({
      teamId,
      reference: { type: 'User', id: userId },
    });

    const { teamRole: currentMemberToUpdateTeamRole } = await getMemberRoles({
      teamId,
      reference: { type: 'Member', id: memberId },
    });

    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, currentMemberToUpdateTeamRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot update a member with a higher role',
      });
    }

    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, data.role)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot update a member to a role higher than your own',
      });
    }

    await prisma.$transaction(async (tx) => {
      if (internalTeamGroupToRemoveMemberFrom) {
        await tx.organisationGroupMember.delete({
          where: {
            organisationMemberId_groupId: {
              organisationMemberId: memberId,
              groupId: internalTeamGroupToRemoveMemberFrom.organisationGroupId,
            },
          },
        });
      }

      await tx.organisationGroupMember.create({
        data: {
          id: generateDatabaseId('group_member'),
          organisationMemberId: memberId,
          groupId: match(data.role)
            .with(TeamMemberRole.MEMBER, () => teamMemberGroup.organisationGroupId)
            .with(TeamMemberRole.MANAGER, () => teamManagerGroup.organisationGroupId)
            .with(TeamMemberRole.ADMIN, () => teamAdminGroup.organisationGroupId)
            .exhaustive(),
        },
      });
    });
  },

  'team.member.delete': async (ctx: ZapContext, raw) => {
    const { teamId, memberId } = ZDeleteTeamMemberRequestSchema.parse(raw);
    const { user } = ctx;

    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery({
        teamId,
        userId: user.id,
        roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
      }),
      include: {
        teamGroups: {
          where: {
            organisationGroup: {
              type: OrganisationGroupType.INTERNAL_TEAM,
              organisationGroupMembers: {
                some: { organisationMember: { id: memberId } },
              },
            },
          },
          include: {
            organisationGroup: {
              include: {
                organisationGroupMembers: { include: { organisationMember: true } },
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    const { teamRole: currentUserTeamRole } = await getMemberRoles({
      teamId,
      reference: { type: 'User', id: user.id },
    });

    const { teamRole: currentMemberToDeleteTeamRole } = await getMemberRoles({
      teamId,
      reference: { type: 'Member', id: memberId },
    });

    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, currentMemberToDeleteTeamRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot remove a member with a higher role',
      });
    }

    const teamGroupToRemoveMemberFrom = team.teamGroups[0];

    if (team.teamGroups.length !== 1) {
      console.error('Member must have 1 one internal team group. This should not happen.');
    }

    if (team.teamGroups.length === 0) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Team has no internal team groups',
      });
    }

    await prisma.organisationGroupMember.delete({
      where: {
        organisationMemberId_groupId: {
          organisationMemberId: memberId,
          groupId: teamGroupToRemoveMemberFrom.organisationGroupId,
        },
      },
    });
  },

  'team.group.find': async (ctx: ZapContext, raw) => {
    const { teamId, types, query, page, perPage, teamGroupId, organisationRoles } =
      ZFindTeamGroupsRequestSchema.parse(raw);
    return await findTeamGroups({
      userId: ctx.user.id,
      teamId,
      teamGroupId,
      types: types ?? [],
      organisationRoles: organisationRoles ?? [],
      query,
      page,
      perPage,
    });
  },

  'team.group.createMany': async (ctx: ZapContext, raw) => {
    const { teamId, groups } = ZCreateTeamGroupsRequestSchema.parse(raw);
    const { user } = ctx;

    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery({
        teamId,
        userId: user.id,
        roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
      }),
      include: {
        organisation: { include: { groups: { include: { teamGroups: true } } } },
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    const { teamRole: currentUserTeamRole } = await getMemberRoles({
      teamId,
      reference: { type: 'User', id: user.id },
    });

    const isValid = groups.every((group) => {
      const organisationGroup = team.organisation.groups.find(
        ({ id }) => id === group.organisationGroupId,
      );

      if (!organisationGroup?.type || !ALLOWED_TEAM_GROUP_TYPES.includes(organisationGroup.type)) {
        return false;
      }

      if (
        organisationGroup.type === OrganisationGroupType.INTERNAL_ORGANISATION &&
        organisationGroup.organisationRole === OrganisationMemberRole.MEMBER &&
        group.teamRole !== TeamMemberRole.MEMBER
      ) {
        return false;
      }

      if (organisationGroup.teamGroups.some((teamGroup) => teamGroup.teamId === teamId)) {
        return false;
      }

      if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, group.teamRole)) {
        return false;
      }

      return true;
    });

    if (!isValid) {
      throw new AppError(AppErrorCode.INVALID_BODY, { message: 'Invalid groups' });
    }

    await prisma.teamGroup.createMany({
      data: groups.map((group) => ({
        id: generateDatabaseId('team_group'),
        teamId,
        organisationGroupId: group.organisationGroupId,
        teamRole: group.teamRole,
      })),
    });
  },

  'team.group.update': async (ctx: ZapContext, raw) => {
    const { id, data } = ZUpdateTeamGroupRequestSchema.parse(raw);
    const { user } = ctx;

    const teamGroup = await prisma.teamGroup.findFirst({
      where: {
        id,
        team: buildTeamWhereQuery({
          teamId: undefined,
          userId: user.id,
          roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
        }),
      },
      include: { organisationGroup: true },
    });

    if (!teamGroup) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Team group not found' });
    }

    if (teamGroup.organisationGroup.type === OrganisationGroupType.INTERNAL_ORGANISATION) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to update internal organisation groups',
      });
    }

    const { teamRole: currentUserTeamRole } = await getMemberRoles({
      teamId: teamGroup.teamId,
      reference: { type: 'User', id: user.id },
    });

    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, teamGroup.teamRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to update this team group',
      });
    }

    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, data.teamRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to set a team role higher than your own',
      });
    }

    await prisma.teamGroup.update({ where: { id }, data: { teamRole: data.teamRole } });
  },

  'team.group.delete': async (ctx: ZapContext, raw) => {
    const { teamGroupId, teamId } = ZDeleteTeamGroupRequestSchema.parse(raw);
    const { user } = ctx;

    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery({
        teamId,
        userId: user.id,
        roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
      }),
    });

    if (!team) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    const group = await prisma.teamGroup.findFirst({
      where: { id: teamGroupId, team: { id: teamId } },
      include: { organisationGroup: true },
    });

    if (!group) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Team group not found' });
    }

    if (
      group.organisationGroup.type === OrganisationGroupType.INTERNAL_ORGANISATION &&
      group.organisationGroup.organisationRole !== OrganisationMemberRole.MEMBER
    ) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to delete internal organisaion groups',
      });
    }

    const { teamRole: currentUserTeamRole } = await getMemberRoles({
      teamId,
      reference: { type: 'User', id: user.id },
    });

    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, group.teamRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to delete this team group',
      });
    }

    await prisma.teamGroup.delete({ where: { id: teamGroupId, teamId } });
  },

  'team.settings.update': async (ctx: ZapContext, raw) => {
    const { user } = ctx;
    const { teamId, data } = ZUpdateTeamSettingsRequestSchema.parse(raw);

    const {
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
      delegateDocumentOwnership,
      envelopeExpirationPeriod,
      brandingEnabled,
      brandingLogo,
      brandingUrl,
      brandingCompanyDetails,
      emailId,
      emailReplyTo,
      emailDocumentSettings,
      defaultRecipients,
      aiFeaturesEnabled,
    } = data;

    if (Object.values(data).length === 0) {
      throw new AppError(AppErrorCode.INVALID_BODY, { message: 'No settings to update' });
    }

    if (
      typedSignatureEnabled === false &&
      uploadSignatureEnabled === false &&
      drawSignatureEnabled === false
    ) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'At least one signature type must be enabled',
      });
    }

    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery({
        teamId,
        userId: user.id,
        roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
      }),
    });

    if (!team) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to update this team.',
      });
    }

    if (emailId) {
      const email = await prisma.organisationEmail.findFirst({
        where: { id: emailId, organisationId: team.organisationId },
      });

      if (!email) {
        throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Email not found' });
      }
    }

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId: team.organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
      select: {
        type: true,
        organisationGlobalSettings: { select: { includeSenderDetails: true } },
      },
    });

    const isPersonalOrganisation = organisation?.type === OrganisationType.PERSONAL;
    const currentIncludeSenderDetails =
      organisation?.organisationGlobalSettings.includeSenderDetails;

    const isChangingIncludeSenderDetails =
      includeSenderDetails !== undefined && includeSenderDetails !== currentIncludeSenderDetails;

    if (isPersonalOrganisation && isChangingIncludeSenderDetails) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Personal teams cannot update the sender details',
      });
    }

    await prisma.team.update({
      where: { id: teamId },
      data: {
        teamGlobalSettings: {
          update: {
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
            delegateDocumentOwnership,
            envelopeExpirationPeriod:
              envelopeExpirationPeriod === null ? Prisma.DbNull : envelopeExpirationPeriod,
            brandingEnabled,
            brandingLogo,
            brandingUrl,
            brandingCompanyDetails,
            emailId,
            emailReplyTo,
            emailDocumentSettings:
              emailDocumentSettings === null ? Prisma.DbNull : emailDocumentSettings,
            defaultRecipients: defaultRecipients === null ? Prisma.DbNull : defaultRecipients,
            aiFeaturesEnabled,
          },
        },
      },
    });
  },

  'team.email.get': async (ctx: ZapContext) => {
    return await getTeamEmailByEmail({ email: ctx.user.email });
  },

  'team.email.update': async (ctx: ZapContext, raw) => {
    const input = ZUpdateTeamEmailMutationSchema.parse(raw);
    return await updateTeamEmail({ userId: ctx.user.id, ...input });
  },

  'team.email.delete': async (ctx: ZapContext, raw) => {
    const { teamId } = ZDeleteTeamEmailMutationSchema.parse(raw);
    return await deleteTeamEmail({
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      teamId,
    });
  },

  'team.email.verification.send': async (ctx: ZapContext, raw) => {
    const { teamId, email, name } = ZCreateTeamEmailVerificationMutationSchema.parse(raw);
    return await createTeamEmailVerification({
      teamId,
      userId: ctx.user.id,
      data: { email, name },
    });
  },

  'team.email.verification.resend': async (ctx: ZapContext, raw) => {
    const { teamId } = ZResendTeamEmailVerificationMutationSchema.parse(raw);
    await resendTeamEmailVerification({ userId: ctx.user.id, teamId });
  },

  'team.email.verification.delete': async (ctx: ZapContext, raw) => {
    const { teamId } = ZDeleteTeamEmailVerificationMutationSchema.parse(raw);
    return await deleteTeamEmailVerification({ userId: ctx.user.id, teamId });
  },
};
