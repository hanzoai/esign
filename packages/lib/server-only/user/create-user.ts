import type { User } from '@prisma/client';

import { createPersonalOrganisation } from '../organisation/create-organisation';

/**
 * Should be run after a user is created, on their first Hanzo IAM sign-in.
 *
 * @returns User
 */
export const onCreateUserHook = async (user: User) => {
  await createPersonalOrganisation({ userId: user.id });

  return user;
};
