import { UserSecurityAuditLogType } from '@prisma/client';
import type { Context } from 'hono';

import { ORGANISATION_USER_ACCOUNT_TYPE } from '@hanzo/esign-lib/constants/organisations';
import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { prisma } from '@hanzo/esign-prisma';

import { HanzoAuthOptions } from '../../config';
import { getSession } from './get-session';

export const deleteAccountProvider = async (c: Context, accountId: string): Promise<void> => {
  const { user } = await getSession(c);

  const requestMeta = c.get('requestMetadata');

  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      userId: user.id,
    },
    select: {
      provider: true,
    },
  });

  // The Hanzo IAM link is how this account signs in; without it nobody could.
  if (account?.provider === HanzoAuthOptions.id) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Hanzo is how you sign in, so it cannot be unlinked',
      statusCode: 400,
    });
  }

  await prisma.$transaction(async (tx) => {
    const deletedAccountProvider = await tx.account.delete({
      where: {
        id: accountId,
        userId: user.id,
      },
      select: {
        type: true,
      },
    });

    await tx.userSecurityAuditLog.create({
      data: {
        userId: user.id,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
        type:
          deletedAccountProvider.type === ORGANISATION_USER_ACCOUNT_TYPE
            ? UserSecurityAuditLogType.ORGANISATION_SSO_UNLINK
            : UserSecurityAuditLogType.ACCOUNT_SSO_UNLINK,
      },
    });
  });
};
