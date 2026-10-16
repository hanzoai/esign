import { NEXT_PUBLIC_WEBAPP_URL } from '@hanzo/esign-lib/constants/app';
import { IAM_PROVIDER } from '@hanzo/esign-lib/constants/auth';
import { env } from '@hanzo/esign-lib/utils/env';

/**
 * How long a session should live for in milliseconds.
 */
export const AUTH_SESSION_LIFETIME = 1000 * 60 * 60 * 24 * 30; // 30 days.

export type OAuthClientOptions = {
  id: string;
  scope: string[];
  clientId: string;
  clientSecret: string;
  wellKnownUrl: string;
  redirectUrl: string;
};

const iamUrl = env('IAM_URL') ?? 'https://hanzo.id';

/**
 * Hanzo IAM is the one way into the app. A person signs in at IAM, and the
 * account they arrive with is IAM's answer, read from its userinfo endpoint.
 */
export const HanzoAuthOptions: OAuthClientOptions = {
  id: IAM_PROVIDER,
  scope: ['openid', 'email', 'profile'],
  clientId: env('IAM_CLIENT_ID') ?? '',
  clientSecret: env('IAM_CLIENT_SECRET') ?? '',
  redirectUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/auth/callback`,
  wellKnownUrl: `${iamUrl}/.well-known/openid-configuration`,
};
