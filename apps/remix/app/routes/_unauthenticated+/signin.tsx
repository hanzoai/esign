import { Trans } from '@lingui/react/macro';
import { redirect } from 'react-router';

import { getOptionalSession } from '@hanzo/esign-auth/server/lib/utils/get-session';
import { SignInRefusal } from '@hanzo/esign-lib/constants/auth';
import { isValidReturnTo, normalizeReturnTo } from '@hanzo/esign-lib/utils/is-valid-return-to';

import { SignInForm } from '~/components/forms/signin';
import { PageHeader } from '~/components/general/page-header';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/signin';

export function meta() {
  return appMetaTags('Sign In');
}

const REFUSALS = new Set<string>(Object.values(SignInRefusal));

export async function loader({ request }: Route.LoaderArgs) {
  const { isAuthenticated } = await getOptionalSession(request);

  const searchParams = new URL(request.url).searchParams;

  let returnTo = searchParams.get('returnTo') ?? undefined;

  returnTo = isValidReturnTo(returnTo) ? normalizeReturnTo(returnTo) : undefined;

  if (isAuthenticated) {
    throw redirect(returnTo || '/');
  }

  const error = searchParams.get('error') ?? '';

  return {
    returnTo,
    refusal: REFUSALS.has(error) ? (error as SignInRefusal) : null,
  };
}

const Refusal = ({ refusal }: { refusal: SignInRefusal }) => {
  switch (refusal) {
    case SignInRefusal.NotInvited:
      return (
        <Trans>
          Hanzo Sign is open to invited people only. Ask an admin to invite you, then sign in again.
        </Trans>
      );
    case SignInRefusal.UnverifiedEmail:
      return (
        <Trans>
          Your Hanzo account's email address is not verified. Verify it at Hanzo, then sign in
          again.
        </Trans>
      );
    case SignInRefusal.UnlinkedAccount:
      return (
        <Trans>
          An account with this email address exists but was never linked to your Hanzo sign-in. Ask
          an admin to link it.
        </Trans>
      );
    case SignInRefusal.Disabled:
      return <Trans>This account has been disabled. Ask an admin to restore it.</Trans>;
  }
};

export default function SignIn({ loaderData }: Route.ComponentProps) {
  const { returnTo, refusal } = loaderData;

  return (
    <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8">
      <PageHeader
        title={<Trans>Sign in to your account</Trans>}
        description={<Trans>Welcome back, we are lucky to have you.</Trans>}
      />

      {refusal && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          <Refusal refusal={refusal} />
        </p>
      )}

      <div className="mt-8">
        <SignInForm returnTo={returnTo} />
      </div>
    </div>
  );
}
