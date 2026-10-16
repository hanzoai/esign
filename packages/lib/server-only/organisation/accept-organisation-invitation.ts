import type { OrganisationGroup, OrganisationMemberRole } from '@prisma/client';
import { OrganisationGroupType, OrganisationMemberInviteStatus } from '@prisma/client';

import { prisma } from '@hanzo/esign-prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobs } from '../../jobs/client';
import { generateDatabaseId } from '../../universal/id';
import { vouches } from '../../utils/iam-sign-in';
import { isInvitedPerson } from './is-invited-person';

export type AcceptOrganisationInvitationOptions = {
  token: string;
  /** The signed-in person accepting. The invitation must name them. */
  userId: number;
};

/**
 * Accept an organisation invitation as the signed-in person it was sent to.
 *
 * The token proves the invitation was received; it does not say who received
 * it. So the invitation joins the person holding the session, and only when that
 * person's verified address is the address it was sent to. Holding the link is
 * never enough to put somebody else into the organisation. And it is accepted
 * only while its sender vouches for it (`vouches`: an ADMIN, not disabled) — the
 * same rule that lets it admit its invitee — and the membership records that
 * sender as the member's inviter.
 */
export const acceptOrganisationInvitation = async ({
  token,
  userId,
}: AcceptOrganisationInvitationOptions) => {
  const organisationMemberInvite = await prisma.organisationMemberInvite.findFirst({
    where: {
      token,
      status: {
        not: OrganisationMemberInviteStatus.DECLINED,
      },
    },
    include: {
      organisation: {
        include: {
          groups: true,
        },
      },
      inviter: {
        select: {
          roles: true,
          disabled: true,
        },
      },
    },
  });

  if (!organisationMemberInvite) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  if (!vouches(organisationMemberInvite.inviter)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'This invitation is no longer valid; ask an admin to invite you again',
      statusCode: 403,
    });
  }

  if (organisationMemberInvite.status === OrganisationMemberInviteStatus.ACCEPTED) {
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Sign in to accept an organisation invitation',
    });
  }

  if (!isInvitedPerson(user, organisationMemberInvite.email)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'This invitation was sent to a different address',
    });
  }

  const { organisation } = organisationMemberInvite;

  const isUserPartOfOrganisation = await prisma.organisationMember.findFirst({
    where: {
      userId: user.id,
      organisationId: organisation.id,
    },
  });

  if (isUserPartOfOrganisation) {
    return;
  }

  await addUserToOrganisation({
    userId: user.id,
    organisationId: organisation.id,
    organisationGroups: organisation.groups,
    organisationMemberRole: organisationMemberInvite.organisationRole,
    invitedById: organisationMemberInvite.inviterId,
  });

  await prisma.organisationMemberInvite.update({
    where: {
      id: organisationMemberInvite.id,
    },
    data: {
      status: OrganisationMemberInviteStatus.ACCEPTED,
    },
  });
};

export const addUserToOrganisation = async ({
  userId,
  organisationId,
  organisationGroups,
  organisationMemberRole,
  invitedById = null,
  bypassEmail = false,
}: {
  userId: number;
  organisationId: string;
  organisationGroups: OrganisationGroup[];
  organisationMemberRole: OrganisationMemberRole;
  /** The sender of the invitation this membership comes from. */
  invitedById?: number | null;
  bypassEmail?: boolean;
}) => {
  const organisationGroupToUse = organisationGroups.find(
    (group) =>
      group.type === OrganisationGroupType.INTERNAL_ORGANISATION &&
      group.organisationRole === organisationMemberRole,
  );

  if (!organisationGroupToUse) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Organisation group not found',
    });
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.organisationMember.create({
        data: {
          id: generateDatabaseId('member'),
          userId,
          organisationId,
          invitedById,
          organisationGroupMembers: {
            create: {
              id: generateDatabaseId('group_member'),
              groupId: organisationGroupToUse.id,
            },
          },
        },
      });
    },
    { timeout: 30_000 },
  );

  if (!bypassEmail) {
    await jobs.triggerJob({
      name: 'send.organisation-member-joined.email',
      payload: {
        organisationId,
        memberUserId: userId,
      },
    });
  }
};
