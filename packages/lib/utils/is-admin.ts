import type { User } from '@prisma/client';

/**
 * Whether the user holds the platform admin role.
 *
 * `Role` is declared in the schema but no model field references it — on the
 * Base SQLite store `User.roles` is a JSON `TEXT` column — so Prisma omits the
 * enum from the generated client and `Role.ADMIN` reads `undefined.ADMIN`.
 * The role name is the stable value; match it directly.
 *
 * `roles` reaches here as a decoded `string[]` (packages/prisma/json-array.ts
 * decodes it at the data layer). Callers include the app shell, which renders
 * before a session refresh settles, so an absent user or column answers `false`
 * rather than throwing and taking the whole tree down.
 */
export const isAdmin = (user?: Pick<User, 'roles'> | null): boolean =>
  user?.roles?.includes('ADMIN') ?? false;
