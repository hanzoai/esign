import { redirect } from 'react-router';

import { isValidReturnTo, normalizeReturnTo } from '@hanzo/esign-lib/utils/is-valid-return-to';

import type { Route } from './+types/signup';

/**
 * Accounts are created at the identity provider, so /signup leads to the same
 * door as /signin. The provider offers account creation on that page.
 *
 * This used to render a local name/email/password form, which produced an
 * account /signin could not then authenticate: sign-in offers the provider and
 * nothing else, so a locally created password had nowhere to be typed.
 */
export function loader({ request }: Route.LoaderArgs) {
  const returnTo = new URL(request.url).searchParams.get('returnTo') ?? undefined;

  const target = isValidReturnTo(returnTo) ? normalizeReturnTo(returnTo) : undefined;

  throw redirect(target ? `/signin?returnTo=${encodeURIComponent(target)}` : '/signin');
}
