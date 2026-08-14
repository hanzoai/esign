import { Trans } from '@lingui/react/macro';
import { redirect } from 'react-router';

import { getOptionalSession } from '@hanzo/esign-auth/server/lib/utils/get-session';
import { isValidReturnTo, normalizeReturnTo } from '@hanzo/esign-lib/utils/is-valid-return-to';

import { brand } from '~/components/branding/brand';
import { HanzoMark } from '~/components/branding/hanzo-mark';
import { SignInForm } from '~/components/forms/signin';
import { PageHeader } from '~/components/general/page-header';
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

  const { primary, suffix } = brand();

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

        <PageHeader
          title={<Trans>Sign in to your account</Trans>}
          description={<Trans>Welcome back, we are lucky to have you.</Trans>}
          descriptionClassName="text-zinc-400"
        />

        <div className="mt-8">
          <SignInForm returnTo={returnTo} />
        </div>
      </div>
    </div>
  );
}
