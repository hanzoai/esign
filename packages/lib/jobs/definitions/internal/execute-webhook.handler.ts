import type { Prisma } from '@prisma/client';
import { WebhookCallStatus } from '@prisma/client';

import { prisma } from '@hanzo/esign-prisma';

import { sendWebhook } from '../../../server-only/webhooks/send';
import type { JobRunIO } from '../../client/_internal/job';
import type { TExecuteWebhookJobDefinition } from './execute-webhook';

export const run = async ({
  payload,
  io,
}: {
  payload: TExecuteWebhookJobDefinition;
  io: JobRunIO;
}) => {
  const { event, webhookId, data } = payload;

  const webhook = await prisma.webhook.findUniqueOrThrow({
    where: {
      id: webhookId,
    },
  });

  const { webhookUrl: url, secret } = webhook;

  const payloadData = {
    event,
    payload: data,
    createdAt: new Date().toISOString(),
    webhookEndpoint: url,
  };

  const sent = await sendWebhook({ url, body: payloadData, secret, teamId: webhook.teamId });

  await prisma.webhookCall.create({
    data: {
      url,
      event,
      status: sent.ok ? WebhookCallStatus.SUCCESS : WebhookCallStatus.FAILED,
      requestBody: payloadData as Prisma.InputJsonValue,
      responseCode: sent.status,
      responseBody: sent.responseBody,
      responseHeaders: sent.responseHeaders,
      webhookId: webhook.id,
    },
  });

  if (!sent.ok) {
    throw new Error(`Webhook execution failed with status ${sent.status}`);
  }

  return {
    success: sent.ok,
    status: sent.status,
  };
};
