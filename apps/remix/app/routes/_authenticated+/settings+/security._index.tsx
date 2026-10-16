import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

import { useSession } from '@hanzo/esign-lib/client-only/providers/session';
import { Alert, AlertDescription, AlertTitle } from '@hanzo/esign-ui/primitives/alert';
import { Button } from '@hanzo/esign-ui/primitives/button';

import { DisableAuthenticatorAppDialog } from '~/components/forms/2fa/disable-authenticator-app-dialog';
import { EnableAuthenticatorAppDialog } from '~/components/forms/2fa/enable-authenticator-app-dialog';
import { ViewRecoveryCodesDialog } from '~/components/forms/2fa/view-recovery-codes-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Security');
}

export default function SettingsSecurity() {
  const { _ } = useLingui();
  const { user } = useSession();

  return (
    <div>
      <SettingsHeader
        title={_(msg`Security`)}
        subtitle={_(msg`Here you can manage your security settings. You sign in with Hanzo.`)}
      />
      <div className="mt-6 space-y-6">
        <Alert
          className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
          variant="neutral"
        >
          <div className="mb-4 sm:mb-0">
            <AlertTitle>
              <Trans>Two factor authentication</Trans>
            </AlertTitle>

            <AlertDescription className="mr-4">
              <Trans>
                Add an authenticator to serve as a secondary authentication method for signing
                documents.
              </Trans>
            </AlertDescription>
          </div>

          {user.twoFactorEnabled ? (
            <DisableAuthenticatorAppDialog />
          ) : (
            <EnableAuthenticatorAppDialog />
          )}
        </Alert>

        {user.twoFactorEnabled && (
          <Alert
            className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
            variant="neutral"
          >
            <div className="mb-4 sm:mb-0">
              <AlertTitle>
                <Trans>Recovery codes</Trans>
              </AlertTitle>

              <AlertDescription className="mr-4">
                <Trans>
                  Two factor authentication recovery codes are used to access your account in the
                  event that you lose access to your authenticator app.
                </Trans>
              </AlertDescription>
            </div>

            <ViewRecoveryCodesDialog />
          </Alert>
        )}

        <Alert
          className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
          variant="neutral"
        >
          <div className="mb-4 sm:mb-0">
            <AlertTitle>
              <Trans>Passkeys</Trans>
            </AlertTitle>

            <AlertDescription className="mr-4">
              <Trans>
                Confirms it is you when signing documents, using biometrics, password managers,
                hardware keys, etc.
              </Trans>
            </AlertDescription>
          </div>

          <Button asChild variant="outline" className="bg-background">
            <Link to="/settings/security/passkeys">
              <Trans>Manage passkeys</Trans>
            </Link>
          </Button>
        </Alert>

        <Alert
          className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
          variant="neutral"
        >
          <div className="mb-4 mr-4 sm:mb-0">
            <AlertTitle>
              <Trans>Recent activity</Trans>
            </AlertTitle>

            <AlertDescription className="mr-2">
              <Trans>View all recent security activity related to your account.</Trans>
            </AlertDescription>
          </div>

          <Button asChild variant="outline" className="bg-background">
            <Link to="/settings/security/activity">
              <Trans>View activity</Trans>
            </Link>
          </Button>
        </Alert>

        <Alert
          className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
          variant="neutral"
        >
          <div className="mb-4 mr-4 sm:mb-0">
            <AlertTitle>
              <Trans>Active sessions</Trans>
            </AlertTitle>

            <AlertDescription className="mr-2">
              <Trans>View and manage all active sessions for your account.</Trans>
            </AlertDescription>
          </div>

          <Button asChild variant="outline" className="bg-background">
            <Link to="/settings/security/sessions">
              <Trans>Manage sessions</Trans>
            </Link>
          </Button>
        </Alert>

        <Alert
          className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
          variant="neutral"
        >
          <div className="mb-4 mr-4 sm:mb-0">
            <AlertTitle>
              <Trans>Linked Accounts</Trans>
            </AlertTitle>

            <AlertDescription className="mr-2">
              <Trans>View and manage all login methods linked to your account.</Trans>
            </AlertDescription>
          </div>

          <Button asChild variant="outline" className="bg-background">
            <Link to="/settings/security/linked-accounts">
              <Trans>Manage linked accounts</Trans>
            </Link>
          </Button>
        </Alert>
      </div>
    </div>
  );
}
