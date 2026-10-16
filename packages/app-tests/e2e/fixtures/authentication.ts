import type { Page } from '@playwright/test';
import { createHash, createHmac, randomBytes } from 'node:crypto';

import { NEXT_PUBLIC_WEBAPP_URL } from '@hanzo/esign-lib/constants/app';
import { formatSecureCookieName } from '@hanzo/esign-lib/constants/auth';
import { prisma } from '@hanzo/esign-prisma';

type LoginOptions = {
  page: Page;
  email?: string;

  /**
   * Where to navigate after login.
   */
  redirectPath?: string;
};

/**
 * Signs the page in as the seeded user with this email.
 *
 * The app signs people in through Hanzo IAM only, and a test cannot drive IAM.
 * So the suite starts the session the way a completed IAM sign-in leaves it: a
 * Session row for the user and the signed `sessionId` cookie that names it,
 * signed with the app's own NEXT_PRIVATE_AUTH_SECRET exactly as hono signs it.
 */
export const apiSignin = async ({
  page,
  email = 'example@esign.hanzo.ai',
  redirectPath = '/',
}: LoginOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      email: email.toLowerCase(),
    },
    select: {
      id: true,
    },
  });

  const token = randomBytes(20).toString('hex');
  const id = createHash('sha256').update(token).digest('hex');

  await prisma.session.create({
    data: {
      id,
      sessionToken: id,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });

  const secret = process.env.NEXT_PRIVATE_AUTH_SECRET;

  if (!secret) {
    throw new Error('NEXT_PRIVATE_AUTH_SECRET is not set');
  }

  const signature = createHmac('sha256', secret).update(token).digest('base64');

  await page.context().addCookies([
    {
      name: formatSecureCookieName('sessionId'),
      value: encodeURIComponent(`${token}.${signature}`),
      url: NEXT_PUBLIC_WEBAPP_URL(),
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}${redirectPath}`);
  await page.waitForTimeout(500);
};

export const apiSignout = async ({ page }: { page: Page }) => {
  const { request } = page.context();

  await request.post(`${NEXT_PUBLIC_WEBAPP_URL()}/v1/auth/signout`);

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/signin`);
};

export const checkSessionValid = async (page: Page): Promise<boolean> => {
  const { request } = page.context();

  const response = await request.fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/v1/auth/session`, {
    method: 'get',
  });

  const session = await response.json();

  return session.isAuthenticated === true;
};
