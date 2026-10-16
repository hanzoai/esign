import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { authClient } from '@hanzo/esign-auth/client';
import { Button } from '@hanzo/esign-ui/primitives/button';
import { useToast } from '@hanzo/esign-ui/primitives/use-toast';

export type DocumentSigningAuthPageViewProps = {
  email?: string;
};

export const DocumentSigningAuthPageView = ({ email }: DocumentSigningAuthPageViewProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleChangeAccount = async () => {
    try {
      setIsSigningOut(true);

      await authClient.signOut({
        redirectPath: '/signin',
      });
    } catch {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`We were unable to log you out at this time.`),
        duration: 10000,
        variant: 'destructive',
      });
    }

    setIsSigningOut(false);
  };

  return (
    <div className="mx-auto flex h-[70vh] w-full max-w-md flex-col items-center justify-center">
      <div>
        <h1 className="text-3xl font-semibold">
          <Trans>Authentication required</Trans>
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {email ? (
            <Trans>
              You need to be logged in as <strong>{email}</strong> to view this page.
            </Trans>
          ) : (
            <Trans>You need to be logged in to view this page.</Trans>
          )}
        </p>

        <Button
          className="mt-4 w-full"
          type="submit"
          onClick={handleChangeAccount}
          loading={isSigningOut}
        >
          <Trans>Sign in with Hanzo</Trans>
        </Button>
      </div>
    </div>
  );
};
