import { EnvelopeType, Prisma } from '@prisma/client';

import { prisma } from '@hanzo/esign-prisma';

type GetAllUsersProps = {
  username: string;
  email: string;
  page: number;
  perPage: number;
};

export const findUsers = async ({
  username = '',
  email = '',
  page = 1,
  perPage = 10,
}: GetAllUsersProps) => {
  // SQLite `LIKE` (Prisma `contains`) is case-insensitive for ASCII, so the
  // Postgres `mode: 'insensitive'` is unnecessary and unsupported here.
  const whereClause = Prisma.validator<Prisma.UserWhereInput>()({
    OR: [
      {
        name: {
          contains: username,
        },
      },
      {
        email: {
          contains: email,
        },
      },
    ],
  });

  const [users, count] = await Promise.all([
    prisma.user.findMany({
      select: {
        _count: {
          select: {
            envelopes: {
              where: {
                type: EnvelopeType.DOCUMENT,
              },
            },
          },
        },
        id: true,
        name: true,
        email: true,
        roles: true,
      },
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  return {
    users: users.map((user) => ({
      ...user,
      documentCount: user._count.envelopes,
    })),
    totalPages: Math.ceil(count / perPage),
  };
};
