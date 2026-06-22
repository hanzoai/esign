import { Trans } from '@lingui/react/macro';
import { redirect } from 'react-router';

import { getOptionalSession } from '@hanzo/esign-auth/server/lib/utils/get-session';
import { env } from '@hanzo/esign-lib/utils/env';
import { isValidReturnTo, normalizeReturnTo } from '@hanzo/esign-lib/utils/is-valid-return-to';

import { HanzoMark } from '~/components/branding/hanzo-mark';
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

// White-label hooks. The signin page reads brand tokens from env so a
// tenant can drop in their own name + provider without touching code:
//
//   NEXT_PUBLIC_APP_NAME           e.g. "Hanzo eSign" | "Acme Sign"
//   NEXT_PUBLIC_APP_NAME_PRIMARY   first word of wordmark
//                                  (defaults to first word of APP_NAME)
//   NEXT_PUBLIC_APP_NAME_SUFFIX    remainder of wordmark
//                                  (defaults to remainder of APP_NAME)
export default function SignIn({ loaderData }: Route.ComponentProps) {
  const { returnTo } = loaderData;

  const appName = env('NEXT_PUBLIC_APP_NAME') || 'Hanzo eSign';
  const [defaultPrimary, ...defaultSuffixParts] = appName.split(' ');
  const primary = env('NEXT_PUBLIC_APP_NAME_PRIMARY') || defaultPrimary || appName;
  const suffix = env('NEXT_PUBLIC_APP_NAME_SUFFIX') || defaultSuffixParts.join(' ');

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-sm">
        <div className="mb-12 flex items-center gap-3">
          <HanzoMark size={28} className="text-white" />
          <span className="text-base font-medium tracking-tight">
            {primary}
            {suffix && <span className="text-zinc-400"> {suffix}</span>}
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
