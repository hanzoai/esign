import { env } from '../utils/env';
import { NEXT_PUBLIC_WEBAPP_URL } from './app';

export const SALT_ROUNDS = 12;

export const IDENTITY_PROVIDER_NAME: Record<string, string> = {
  HANZO_SIGN: 'Hanzo Sign',
  GOOGLE: 'Google',
  MICROSOFT: 'Microsoft',
  OIDC: 'OIDC',
};

export const IS_IAM_SSO_ENABLED = Boolean(env('IAM_CLIENT_ID'));

/**
 * Why a Hanzo IAM sign-in was turned away. The callback redirects to
 * `/signin?error=<reason>` and the sign-in page says it in a sentence, so the
 * person knows what to do next.
 */
export const SignInRefusal = {
  /** IAM has not proved the address the account would be named after. */
  UnverifiedEmail: 'unverified-email',
  /** An account holds this address but was never linked to an IAM sign-in. */
  UnlinkedAccount: 'unlinked-account',
  /** Nobody invited this person and they do not administer the org. */
  NotInvited: 'not-invited',
  /** An admin disabled the account. */
  Disabled: 'disabled',
} as const;

export type SignInRefusal = (typeof SignInRefusal)[keyof typeof SignInRefusal];

export const USER_SECURITY_AUDIT_LOG_MAP: Record<string, string> = {
  ACCOUNT_SSO_LINK: 'Linked account to SSO',
  ACCOUNT_SSO_UNLINK: 'Unlinked account from SSO',
  ORGANISATION_SSO_LINK: 'Linked account to organisation',
  ORGANISATION_SSO_UNLINK: 'Unlinked account from organisation',
  ACCOUNT_PROFILE_UPDATE: 'Profile updated',
  AUTH_2FA_DISABLE: '2FA Disabled',
  AUTH_2FA_ENABLE: '2FA Enabled',
  PASSKEY_CREATED: 'Passkey created',
  PASSKEY_DELETED: 'Passkey deleted',
  PASSKEY_UPDATED: 'Passkey updated',
  PASSWORD_RESET: 'Password reset',
  PASSWORD_UPDATE: 'Password updated',
  SESSION_REVOKED: 'Session revoked',
  SIGN_OUT: 'Signed Out',
  SIGN_IN: 'Signed In',
  SIGN_IN_FAIL: 'Sign in attempt failed',
  SIGN_IN_PASSKEY_FAIL: 'Passkey sign in failed',
  SIGN_IN_2FA_FAIL: 'Sign in 2FA attempt failed',
};

/**
 * The duration to wait for a passkey to be verified in MS.
 */
export const PASSKEY_TIMEOUT = 60000;

/**
 * The maximum number of passkeys are user can have.
 */
export const MAXIMUM_PASSKEYS = 50;

export const useSecureCookies =
  env('NODE_ENV') === 'production' && String(NEXT_PUBLIC_WEBAPP_URL()).startsWith('https://');

const secureCookiePrefix = useSecureCookies ? '__Secure-' : '';

export const formatSecureCookieName = (name: string) => `${secureCookiePrefix}${name}`;

export const getCookieDomain = () => {
  const url = new URL(NEXT_PUBLIC_WEBAPP_URL());

  return url.hostname;
};
