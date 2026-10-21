import type { Prisma } from '@prisma/client';

import { prisma } from '@hanzo/esign-prisma';

import { env } from '../../utils/env';
import { HANZO_API, machine } from '../iam/token';

/**
 * The webhooks this application posts as itself, from HANZO_WEBHOOKS: `<team
 * url>=<URL on the Hanzo API>`, comma-separated, read as `<team url> <URL>` keys.
 * A webhook is eSign's own only when its team AND its URL are listed together:
 * any other team pointing at the same URL is a stranger to it. Empty is none.
 */
export const receivers = (raw = env('HANZO_WEBHOOKS') ?? ''): Set<string> =>
  new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().split('='))
      .filter(
        ([team, url, ...rest]) =>
          rest.length === 0 &&
          Boolean(team) &&
          Boolean(url) &&
          URL.canParse(url) &&
          new URL(url).origin === HANZO_API,
      )
      .map(([team, url]) => `${team} ${url}`),
  );

/**
 * Posts one webhook, the one way every send and resend goes out.
 *
 * A webhook HANZO_WEBHOOKS lists, its team and its exact URL together, is posted
 * as this application: an IAM token minted for the Hanzo API, which verifies it
 * like any other caller, so the receiver holds no secret of ours. It follows no
 * redirect, so the token goes nowhere but the URL listed, and what the receiver
 * answered is not kept for the team to read. Every other webhook is sent no
 * identity at all, only its own secret: a team chooses where its webhook points,
 * and must never be able to aim eSign's credential at an endpoint of its choosing.
 */
export const sendWebhook = async ({
  url,
  body,
  secret,
  teamId,
}: {
  url: string;
  body: unknown;
  secret: string | null;
  teamId: number;
}) => {
  const listed = receivers();
  const team =
    listed.size > 0
      ? await prisma.team.findUnique({ where: { id: teamId }, select: { url: true } })
      : null;
  const identity = Boolean(team) && listed.has(`${team?.url} ${url}`);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Hanzo-Secret': secret ?? '',
  };

  if (identity) {
    headers.Authorization = `Bearer ${await machine.token(HANZO_API)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
    redirect: identity ? 'manual' : 'follow',
  });
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
