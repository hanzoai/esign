import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';
import { PASSKEY_TIMEOUT } from '../constants/auth';
import { env } from './env';

/**
 * Extracts common fields to identify the RP (relying party)
 */
export const getAuthenticatorOptions = () => {
  const webAppBaseUrl = new URL(NEXT_PUBLIC_WEBAPP_URL());
  const rpId = webAppBaseUrl.hostname;

  return {
    rpName: env('NEXT_PUBLIC_APP_NAME') || 'Hanzo Sign',
    rpId,
    origin: NEXT_PUBLIC_WEBAPP_URL(),
    timeout: PASSKEY_TIMEOUT,
  };
};
