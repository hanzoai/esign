import { OrganisationMemberInviteStatus } from '@prisma/client';

import { prisma } from '@hanzo/esign-prisma';

import { IAM_PROVIDER } from '../../constants/auth';
import type { Standing } from '../../utils/iam-sign-in';
import { vouches } from '../../utils/iam-sign-in';

const voucher = { select: { roles: true, disabled: true } } as const;

/**
 * A user's standing as the store holds it: disabled or not, linked to IAM or
 * not, and the facts admission is decided from. ADMIN is IAM's answer recorded
 * at the user's last sign-in. Null when the user does not exist.
 */
export const readStanding = async (userId: number): Promise<Standing | null> => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    select: {
      email: true,
      emailVerified: true,
      roles: true,
      disabled: true,
      accounts: {
        where: {
          provider: IAM_PROVIDER,
        },
        select: {
          id: true,
        },
        take: 1,
      },
      organisationMember: {
        select: {
          invitedBy: voucher,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const invites = user.emailVerified
    ? await prisma.organisationMemberInvite.findMany({
        where: {
          email: user.email.toLowerCase(),
          status: OrganisationMemberInviteStatus.PENDING,
        },
        select: {
          inviter: voucher,
        },
      })
    : [];

  return {
    disabled: user.disabled,
    linkedToIam: user.accounts.length > 0,
    admission: {
      iamAdmin: user.roles.includes('ADMIN'),
      vouchedMembership: user.organisationMember.some((member) => vouches(member.invitedBy)),
      vouchedInvite: invites.some((invite) => vouches(invite.inviter)),
    },
  };
};
