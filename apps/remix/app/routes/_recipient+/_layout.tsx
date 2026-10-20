import { Trans } from '@lingui/react/macro';
import { ChevronLeft } from 'lucide-react';
import { Link, Outlet, isRouteErrorResponse } from 'react-router';

import { useOptionalSession } from '@hanzo/esign-lib/client-only/providers/session';
import { Button } from '@hanzo/esign-ui/primitives/button';

import { AppFooter } from '~/components/general/app-footer';
import { Header as AuthenticatedHeader, PublicHeader } from '~/components/general/app-header';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';

import type { Route } from './+types/_layout';

/**
 * A layout to handle scenarios where the user is a recipient of a given resource
 * where we do not care whether they are authenticated or not.
 *
 * Such as direct template access, or signing.
 */
export default function RecipientLayout({ matches }: Route.ComponentProps) {
  const { sessionData } = useOptionalSession();

  // Hide the header and footer for signing routes: the signer draws its own bar.
  const hideHeader = matches.some(
    (match) =>
      match?.id === 'routes/_recipient+/sign.$token+/_index' ||
      match?.id === 'routes/_recipient+/d.$token+/_index',
  );

  if (hideHeader) {
    return (
      <div className="min-h-screen">
        <main>
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {sessionData?.user ? <AuthenticatedHeader /> : <PublicHeader />}

      <main className="mb-8 mt-8 flex-1 px-4 md:mb-12 md:mt-12 md:px-8">
        <Outlet />
      </main>

      <AppFooter />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const errorCode = isRouteErrorResponse(error) ? error.status : 500;

  return (
    <GenericErrorLayout
      errorCode={errorCode}
      secondaryButton={null}
      primaryButton={
        <Button asChild className="w-32">
          <Link to="/">
            <ChevronLeft className="mr-2 h-4 w-4" />
            <Trans>Go Back</Trans>
          </Link>
        </Button>
      }
    />
  );
}
