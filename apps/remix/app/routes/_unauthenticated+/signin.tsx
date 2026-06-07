import { Trans } from '@lingui/react/macro';
import { redirect } from 'react-router';

import { getOptionalSession } from '@hanzo/sign-auth/server/lib/utils/get-session';
import { isValidReturnTo, normalizeReturnTo } from '@hanzo/sign-lib/utils/is-valid-return-to';

import { SignInForm } from '~/components/forms/signin';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/signin';

export function meta() {
  return appMetaTags('Sign In');
}

export async function loader({ request }: Route.LoaderArgs) {
  const { isAuthenticated } = await getOptionalSession(request);

  let returnTo = new URL(request.url).searchParams.get('returnTo') ?? undefined;

  returnTo = isValidReturnTo(returnTo) ? normalizeReturnTo(returnTo) : undefined;

  if (isAuthenticated) {
    throw redirect(returnTo || '/');
  }

  return {
    returnTo,
  };
}

export default function SignIn({ loaderData }: Route.ComponentProps) {
  const { returnTo } = loaderData;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-sm">
        <div className="mb-12 flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-white text-base font-extrabold text-black">
            H
          </span>
          <span className="text-base font-medium tracking-tight">
            Hanzo <span className="text-zinc-400">eSign</span>
          </span>
        </div>

        <h1 className="text-balance text-3xl font-semibold">
          <Trans>Sign in to your account</Trans>
        </h1>
        <p className="mt-2 text-balance text-sm text-zinc-400">
          <Trans>Welcome back, we are lucky to have you.</Trans>
        </p>

        <div className="mt-8">
          <SignInForm returnTo={returnTo} />
        </div>
      </div>
    </div>
  );
}
