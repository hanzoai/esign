import { prisma } from '@hanzo/esign-prisma';

import { AppError, AppErrorCode } from '../../../errors/app-error';
import type { JobRunIO } from '../../client/_internal/job';
import type { TBackportSubscriptionClaimJobDefinition } from './backport-subscription-claims';

export const run = async ({
  payload,
  io,
}: {
  payload: TBackportSubscriptionClaimJobDefinition;
  io: JobRunIO;
}) => {
  const { subscriptionClaimId, flags } = payload;

  const subscriptionClaim = await prisma.subscriptionClaim.findFirst({
    where: {
      id: subscriptionClaimId,
    },
  });

  if (!subscriptionClaim) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Subscription claim not found' });
  }

  await io.runTask('backport-claims', async () => {
    const newFlagsJson = JSON.stringify(flags);

    // SQLite: `json_patch(a, b)` does an RFC-7396 shallow merge of `flags`
    // (new keys added, existing keys overwritten). `flags` is stored as JSON
    // text, so the patch operand is the stringified new flags.
    await prisma.$executeRaw`
      UPDATE "OrganisationClaim"
      SET "flags" = json_patch("flags", ${newFlagsJson})
      WHERE "originalSubscriptionClaimId" = ${subscriptionClaimId}
    `;
  });
};
