import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { authClient } from '@documenso/auth/client';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

const LOGIN_REDIRECT_PATH = '/';

export type SignInFormProps = {
  className?: string;
  returnTo?: string;
};

export const SignInForm = ({ className, returnTo }: SignInFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const redirectPath = useMemo(() => {
    if (typeof window === 'undefined') {
      return LOGIN_REDIRECT_PATH;
    }

    let url = new URL(returnTo || LOGIN_REDIRECT_PATH, window.location.origin);

    if (url.origin !== window.location.origin) {
      url = new URL(LOGIN_REDIRECT_PATH, window.location.origin);
    }

    return url.toString();
  }, [returnTo]);

  const onSignInWithHanzoClick = async () => {
    try {
      await authClient.hanzo.signIn({
        redirectPath,
      });
    } catch (err) {
      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to sign you In. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className={cn('flex w-full flex-col gap-y-4', className)}>
      <Button
        type="button"
        size="lg"
        className="border bg-red-500 text-white hover:bg-red-600"
        onClick={onSignInWithHanzoClick}
      >
        <svg className="mr-2 h-5 w-5" viewBox="0 0 67 67" fill="currentColor">
          <path d="M22.21 67V44.6369H0V67H22.21Z" />
          <path d="M66.7038 22.3184H22.2534L0.0878906 44.6367H44.4634L66.7038 22.3184Z" />
          <path d="M22.21 0H0V22.3184H22.21V0Z" />
          <path d="M66.7198 0H44.5098V22.3184H66.7198V0Z" />
          <path d="M66.7198 67V44.6369H44.5098V67H66.7198Z" />
        </svg>
        <Trans>Sign in with Hanzo</Trans>
      </Button>
    </div>
  );
};
