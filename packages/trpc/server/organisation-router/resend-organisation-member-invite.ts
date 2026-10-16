import { OrganisationMemberInviteStatus } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@hanzo/esign-lib/constants/organisations';
import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { sendOrganisationMemberInviteEmail } from '@hanzo/esign-lib/server-only/organisation/create-organisation-member-invites';
import { newInvitation } from '@hanzo/esign-lib/server-only/organisation/new-invitation';
import { assertAdmin } from '@hanzo/esign-lib/server-only/user/assert-admin';
import { buildOrganisationWhereQuery } from '@hanzo/esign-lib/utils/organisations';
import { prisma } from '@hanzo/esign-prisma';

import {
  ZResendOrganisationMemberInviteRequestSchema,
  ZResendOrganisationMemberInviteResponseSchema,
} from './resend-organisation-member-invite.types';

export type ResendOrganisationMemberInvitationOptions = {
  /**
   * The ID of the user who is initiating this action.
   */
  userId: number;

  /**
   * The name of the user who is initiating this action.
   */
  userName: string;

  /**
   * The ID of the organisation.
   */
  organisationId: string;

  /**
   * The IDs of the invitations to resend.
   */
  invitationId: string;
};

/**
 * Resend a member invite as a fresh invitation from the resender. Only an
 * ADMIN resends.
 */
export const resendOrganisationMemberInvitation = async ({
  userId,
  userName,
  organisationId,
  invitationId,
}: ResendOrganisationMemberInvitationOptions): Promise<void> => {
  await assertAdmin(userId);

  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
    include: {
      organisationGlobalSettings: true,
      invites: {
        where: {
          id: invitationId,
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError('OrganisationNotFound', {
      message: 'User is not a valid member of the team.',
      statusCode: 404,
    });
  }

  const invitation = organisation.invites[0];

  if (!invitation || invitation.status !== OrganisationMemberInviteStatus.PENDING) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Invitation does not exist',
    });
  }

  // A resend is a fresh invitation from the resender: new token, sent now. The
  // old one, and its link, stop working.
  const reissued = newInvitation(invitation, userId);

  await prisma.$transaction(async (tx) => {
    await tx.organisationMemberInvite.delete({
      where: {
        id: invitation.id,
      },
    });

    await tx.organisationMemberInvite.create({
      data: reissued,
    });
  });

  await sendOrganisationMemberInviteEmail({
    email: reissued.email,
    token: reissued.token,
    senderName: userName,
    organisation,
  });
};
