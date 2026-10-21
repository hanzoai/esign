import type { Prisma } from '@prisma/client';
import { WebhookCallStatus } from '@prisma/client';

import { prisma } from '@hanzo/esign-prisma';

import { machine } from '../../../server-only/iam/token';
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

  // The call is made as this application: an IAM token minted for the
  // endpoint's own origin (RFC 8707), which the receiver verifies against IAM's
  // keys, and which no other service would accept. A Hanzo service receiving it
  // needs no secret of its own; the webhook's secret, when one was set, rides
  // beside it for a receiver outside Hanzo.
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payloadData),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await machine.token(new URL(url).origin)}`,
      'X-Hanzo-Secret': secret ?? '',
    },
  });

  const body = await response.text();

  let responseBody: Prisma.InputJsonValue | Prisma.JsonNullValueInput;

  try {
    responseBody = JSON.parse(body);
  } catch (err) {
    responseBody = body;
  }

  await prisma.webhookCall.create({
    data: {
      url,
      event,
      status: response.ok ? WebhookCallStatus.SUCCESS : WebhookCallStatus.FAILED,
      requestBody: payloadData as Prisma.InputJsonValue,
      responseCode: response.status,
      responseBody,
      responseHeaders: Object.fromEntries(response.headers.entries()),
      webhookId: webhook.id,
    },
  });

  if (!response.ok) {
    throw new Error(`Webhook execution failed with status ${response.status}`);
  }

  return {
    success: response.ok,
    status: response.status,
  };
};
