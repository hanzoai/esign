import type { Prisma } from '@prisma/client';

import { env } from '../../utils/env';
import { HANZO_API, machine } from '../iam/token';

/**
 * The webhook endpoints this application posts to as itself, from HANZO_WEBHOOKS:
 * full URLs on the Hanzo API, comma-separated. Empty is none.
 */
export const receivers = (raw = env('HANZO_WEBHOOKS') ?? ''): Set<string> =>
  new Set(
    raw
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url !== '' && URL.canParse(url) && new URL(url).origin === HANZO_API),
  );

/**
 * Posts one webhook, the one way every send and resend goes out.
 *
 * A URL HANZO_WEBHOOKS lists, exactly, is posted as this application: an IAM
 * token minted for the Hanzo API, which verifies it like any other caller, so the
 * receiver holds no secret of ours. Every other URL is sent no identity at all,
 * only the webhook's own secret: a team chooses where its webhook points, and must
 * never be able to aim eSign's credential at an endpoint of its choosing. What a
 * receiver answered a call made as eSign is not kept for the team to read.
 */
export const sendWebhook = async ({
  url,
  body,
  secret,
}: {
  url: string;
  body: unknown;
  secret: string | null;
}) => {
  const identity = receivers().has(url);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Hanzo-Secret': secret ?? '',
  };

  if (identity) {
    headers.Authorization = `Bearer ${await machine.token(HANZO_API)}`;
  }

  const response = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers });
  const text = await response.text();

  let responseBody: Prisma.InputJsonValue = text;

  try {
    responseBody = JSON.parse(text);
  } catch {
    // Not JSON: kept as the text it is.
  }

  return {
    ok: response.ok,
    status: response.status,
    responseBody: identity ? '' : responseBody,
    responseHeaders: identity ? {} : Object.fromEntries(response.headers.entries()),
  };
};
