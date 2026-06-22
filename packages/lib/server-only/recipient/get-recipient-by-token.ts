import { prisma } from '@hanzo/esign-prisma';

export interface GetRecipientByTokenOptions {
  token: string;
}

export const getRecipientByToken = async ({ token }: GetRecipientByTokenOptions) => {
  return await prisma.recipient.findFirstOrThrow({
    where: {
      token,
    },
    include: {
      fields: true,
    },
  });
};
