import { SIGN_ENCRYPTION_KEY } from '@hanzo/esign-lib/constants/crypto';
import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { symmetricDecrypt } from '@hanzo/esign-lib/universal/crypto';
import { formatOrganisationCallbackUrl } from '@hanzo/esign-lib/utils/organisation-authentication-portal';
import { prisma } from '@hanzo/esign-prisma';

type GetOrganisationAuthenticationPortalOptions =
  | {
      type: 'url';
      organisationUrl: string;
    }
  | {
      type: 'id';
      organisationId: string;
    };

export const getOrganisationAuthenticationPortalOptions = async (
  options: GetOrganisationAuthenticationPortalOptions,
) => {
  const organisation = await prisma.organisation.findFirst({
    where:
      options.type === 'url'
        ? {
            url: options.organisationUrl,
          }
        : {
            id: options.organisationId,
          },
    include: {
      organisationAuthenticationPortal: true,
      groups: true,
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  if (!organisation.organisationAuthenticationPortal.enabled) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Authentication portal is not enabled for this organisation',
    });
  }

  const {
    clientId,
    clientSecret: encryptedClientSecret,
    wellKnownUrl,
  } = organisation.organisationAuthenticationPortal;

  if (!clientId || !encryptedClientSecret || !wellKnownUrl) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Authentication portal is not configured for this organisation',
    });
  }

  if (!SIGN_ENCRYPTION_KEY) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Encryption key is not set',
    });
  }

  const clientSecret = Buffer.from(
    symmetricDecrypt({ key: SIGN_ENCRYPTION_KEY, data: encryptedClientSecret }),
  ).toString('utf-8');

  return {
    organisation,
    clientId,
    clientSecret,
    wellKnownUrl,
    clientOptions: {
      id: organisation.id,
      scope: ['openid', 'email', 'profile'],
      clientId,
      clientSecret,
      redirectUrl: formatOrganisationCallbackUrl(organisation.url),
      wellKnownUrl,
    },
  };
};
