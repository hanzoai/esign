import type { WebhookTriggerEvents } from '@prisma/client';

import { prisma } from '@hanzo/esign-prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type GetAllWebhooksByEventTriggerOptions = {
  event: WebhookTriggerEvents;
  userId: number;
  teamId: number;
};

export const getAllWebhooksByEventTrigger = async ({
  event,
  userId,
  teamId,
}: GetAllWebhooksByEventTriggerOptions) => {
  // `eventTriggers` is a JSON-encoded list in SQLite, so it can't be filtered
  // with a Postgres `has` array predicate. The enabled-webhook set for a team
  // is small; fetch it and filter on the decoded array (the client extension
  // hands `eventTriggers` back as a real list). See @hanzo/esign-prisma/json-array.
  const webhooks = await prisma.webhook.findMany({
    where: {
      enabled: true,
      team: buildTeamWhereQuery({
        teamId,
        userId,
      }),
    },
  });

  return webhooks.filter((webhook) => webhook.eventTriggers.includes(event));
};
