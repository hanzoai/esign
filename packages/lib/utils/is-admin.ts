import type { User } from '@prisma/client';

// On the Base SQLite schema, `User.roles` is a JSON string[] and no model field
// references the `Role` enum, so Prisma stops emitting it to the generated
// client — importing `Role` yields `undefined` and `Role.ADMIN` throws in every
// caller (it took down the whole authenticated shell via app-header's isAdmin).
// The role name is the stable value; match it directly. `.includes` is correct
// whether `roles` arrives parsed (string[]) or as the raw JSON string.
export const isAdmin = (user: Pick<User, 'roles'>) => user.roles.includes('ADMIN');
