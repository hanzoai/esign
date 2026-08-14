import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { TeamMemberRole } from '@prisma/client';
import { DateTime } from 'luxon';

import { DOCS_URL } from '@hanzo/esign-lib/constants/app';
import type { TGetApiTokensResponse } from '@hanzo/esign-trpc/server/api-token-router/get-api-tokens.types';
import { useZapQuery } from '@hanzo/esign-trpc/zap/react';
import { Alert, AlertDescription } from '@hanzo/esign-ui/primitives/alert';
import { AlertTitle } from '@hanzo/esign-ui/primitives/alert';
import { Button } from '@hanzo/esign-ui/primitives/button';

import TokenDeleteDialog from '~/components/dialogs/token-delete-dialog';
import { ApiTokenForm } from '~/components/forms/token';
import { SettingsHeader } from '~/components/general/settings-header';
import { useOptionalCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('API Tokens');
}

export default function ApiTokensPage() {
  const { i18n } = useLingui();

  const { data: tokens } = useZapQuery<TGetApiTokensResponse>('apiToken.getMany');

  const team = useOptionalCurrentTeam();

  return (
    <div>
      <SettingsHeader
        title={<Trans>API Tokens</Trans>}
        subtitle={
          <Trans>
            On this page, you can create and manage API tokens. See our{' '}
            <a
              className="text-primary underline"
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Documentation
            </a>{' '}
            for more information.
          </Trans>
        }
      />

      {team && team?.currentTeamRole !== TeamMemberRole.ADMIN ? (
        <Alert
          className="flex flex-col items-center justify-between gap-4 p-6 md:flex-row"
          variant="warning"
        >
          <div>
            <AlertTitle>
              <Trans>Unauthorized</Trans>
            </AlertTitle>
            <AlertDescription className="mr-2">
              <Trans>You need to be an admin to manage API tokens.</Trans>
            </AlertDescription>
          </div>
        </Alert>
      ) : (
        <>
          <ApiTokenForm className="max-w-xl" tokens={tokens} />

          <hr className="mb-4 mt-8" />

          <h4 className="text-xl font-medium">
            <Trans>Your existing tokens</Trans>
          </h4>

          {tokens && tokens.length === 0 && (
            <div className="mb-4">
              <p className="mt-2 text-sm italic text-muted-foreground">
                <Trans>Your tokens will be shown here once you create them.</Trans>
              </p>
            </div>
          )}

          {tokens && tokens.length > 0 && (
            <div className="mt-4 flex max-w-xl flex-col gap-y-4">
              {tokens.map((token) => (
                <div key={token.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-x-4">
                    <div>
                      <h5 className="text-base">{token.name}</h5>

                      <p className="mt-2 text-xs text-muted-foreground">
                        <Trans>
                          Created on {i18n.date(token.createdAt, DateTime.DATETIME_FULL)}
                        </Trans>
                      </p>
                      {token.expires ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          <Trans>
                            Expires on {i18n.date(token.expires, DateTime.DATETIME_FULL)}
                          </Trans>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          <Trans>Token doesn't have an expiration date</Trans>
                        </p>
                      )}
                    </div>

                    <div>
                      <TokenDeleteDialog token={token}>
                        <Button variant="destructive">
                          <Trans>Delete</Trans>
                        </Button>
                      </TokenDeleteDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
