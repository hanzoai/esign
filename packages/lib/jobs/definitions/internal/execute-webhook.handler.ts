import type { Prisma } from '@prisma/client';
import { WebhookCallStatus } from '@prisma/client';

import { prisma } from '@hanzo/esign-prisma';

import { HANZO_API, machine } from '../../../server-only/iam/token';
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

  // A webhook to the Hanzo API is made as this application: an IAM token minted
  // for that API (RFC 8707), which it verifies like any other caller, so the
  // receiver holds no secret of ours. Any other endpoint is sent no identity at
  // all, only the webhook's own secret when one was set: a team's webhook must
  // never hand eSign's credential to wherever it points.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Hanzo-Secret': secret ?? '',
  };

  if (new URL(url).origin === HANZO_API) {
    headers.Authorization = `Bearer ${await machine.token(HANZO_API)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payloadData),
    headers,
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
