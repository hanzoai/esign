import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { createTOTPKeyURI } from 'oslo/otp';

import { SIGN_ENCRYPTION_KEY } from '../../../constants/crypto';

const ISSUER = `${process.env.NEXT_PUBLIC_APP_NAME || 'Hanzo Sign'} Email 2FA`;

export type GenerateTwoFactorCredentialsFromEmailOptions = {
  envelopeId: string;
  email: string;
};

/**
 * Generate an encrypted token containing a 6-digit 2FA code for email verification.
 *
 * @param options - The options for generating the token
 * @returns Object containing the token and the 6-digit code
 */
export const generateTwoFactorCredentialsFromEmail = ({
  envelopeId,
  email,
}: GenerateTwoFactorCredentialsFromEmailOptions) => {
  if (!SIGN_ENCRYPTION_KEY) {
    throw new Error('Missing SIGN_ENCRYPTION_KEY');
  }

  const identity = `email-2fa|v1|email:${email}|id:${envelopeId}`;

  const secret = hmac(sha256, SIGN_ENCRYPTION_KEY, identity);

  const uri = createTOTPKeyURI(ISSUER, email, secret.buffer as ArrayBuffer);

  return {
    uri,
    secret,
  };
};
