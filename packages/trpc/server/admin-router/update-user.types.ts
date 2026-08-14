import { z } from 'zod';

// `Role` is not exported by the generated client on the Base SQLite schema
// (User.roles is a JSON string[], so the enum is orphaned). z.nativeEnum(Role)
// would run at module load with `undefined` and throw. The values are stable.
export const ZUpdateUserRequestSchema = z.object({
  id: z.number().min(1),
  name: z.string().nullish(),
  email: z.string().email().optional(),
  roles: z.array(z.enum(['USER', 'ADMIN'])).optional(),
});

export const ZUpdateUserResponseSchema = z.void();

export type TUpdateUserRequest = z.infer<typeof ZUpdateUserRequestSchema>;
export type TUpdateUserResponse = z.infer<typeof ZUpdateUserResponseSchema>;
