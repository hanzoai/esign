import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { authClient } from '@hanzo/sign-auth/client';
import { env } from '@hanzo/sign-lib/utils/env';
import { cn } from '@hanzo/sign-ui/lib/utils';
import { Button } from '@hanzo/sign-ui/primitives/button';
import { useToast } from '@hanzo/sign-ui/primitives/use-toast';

const LOGIN_REDIRECT_PATH = '/';

export type SignInFormProps = {
  className?: string;
  returnTo?: string;
};

export const SignInForm = ({ className, returnTo }: SignInFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const providerName = env('NEXT_PUBLIC_IAM_PROVIDER_NAME') || 'Hanzo';

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

  const onSignInClick = async () => {
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
        onClick={onSignInClick}
      >
        Sign in with <span className="ml-1 font-bold">{providerName}</span>
      </Button>
    </div>
  );
};
