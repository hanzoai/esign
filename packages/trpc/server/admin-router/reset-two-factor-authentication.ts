import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { prisma } from '@hanzo/sign-prisma';

import {
  ZResetTwoFactorRequestSchema,
  ZResetTwoFactorResponseSchema,
} from './reset-two-factor-authentication.types';

export type ResetTwoFactorOptions = {
  userId: number;
};

export const resetTwoFactor = async ({ userId }: ResetTwoFactorOptions) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'User not found' });
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      twoFactorEnabled: false,
      twoFactorBackupCodes: null,
      twoFactorSecret: null,
    },
  });
};
