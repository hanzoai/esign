import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { enableUser } from '@hanzo/sign-lib/server-only/user/enable-user';
import { getUserById } from '@hanzo/sign-lib/server-only/user/get-user-by-id';

import { adminProcedure } from '../trpc';
import { ZEnableUserRequestSchema, ZEnableUserResponseSchema } from './enable-user.types';

export const enableUserRoute = adminProcedure
  .input(ZEnableUserRequestSchema)
  .output(ZEnableUserResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id } = input;

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
  });
