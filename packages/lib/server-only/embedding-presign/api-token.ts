import { prisma } from '@hanzo/esign-prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { credentialIsCurrent } from '../../utils/iam-sign-in';
import { hashString } from '../auth/hash';
import { readStanding } from '../user/standing';

/**
 * An embedding presign token is signed with the API token it was minted from, so
 * the embed authoring flow is the one place an API token is still read. It is a
 * credential a customer's backend hands its own iframe, never a way into this
 * server's API: every bearer the API accepts is an IAM token (public-api/get-bearer).
 */
export const apiTokenByToken = async ({ token }: { token: string }) => {
  const hashedToken = hashString(token);

  const apiToken = await prisma.apiToken.findFirst({
    where: {
      token: hashedToken,
    },
    include: {
      team: {
        include: {
          organisation: {
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  disabled: true,
                },
              },
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          disabled: true,
        },
      },
    },
  });

  if (!apiToken) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid token',
      statusCode: 401,
    });
  }

  if (apiToken.expires && apiToken.expires < new Date()) {
    throw new AppError(AppErrorCode.EXPIRED_CODE, {
      message: 'Expired token',
      statusCode: 401,
    });
  }

  // Handle a silly choice from many moons ago
  if (apiToken.team && !apiToken.user) {
    apiToken.user = apiToken.team.organisation.owner;
  }

  const { user } = apiToken;

  // This will never happen but we need to narrow types
  if (!user) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid token',
      statusCode: 401,
    });
  }

  // A token works only while its holder's credentials are current: linked to
  // Hanzo IAM, not disabled, and admitted. A team token's holder is the
  // organisation's owner.
  const standing = await readStanding(user.id);

  if (!standing || !credentialIsCurrent(standing)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid token',
      statusCode: 401,
    });
  }

  return {
    ...apiToken,
    user,
  };
};
