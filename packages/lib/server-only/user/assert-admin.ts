import { prisma } from '@hanzo/esign-prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { isAdmin } from '../../utils/is-admin';

/**
 * Refuses unless the user holds ADMIN and is not disabled. ADMIN is what an IAM
 * sign-in grants a person IAM says administers the app's org, so this is the
 * gate on bringing anyone new in: creating an organisation and inviting people.
 */
export const assertAdmin = async (userId: number): Promise<void> => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    select: {
      roles: true,
      disabled: true,
    },
  });

  if (!user || user.disabled || !isAdmin(user)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Only an admin can create organisations and invite people',
      statusCode: 403,
    });
  }
};
