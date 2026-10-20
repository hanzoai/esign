import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { ChevronLeft } from 'lucide-react';
import { Link, Outlet, isRouteErrorResponse } from 'react-router';

import { useOptionalSession } from '@hanzo/esign-lib/client-only/providers/session';
import { Button } from '@hanzo/esign-ui/primitives/button';

import { AppFooter } from '~/components/general/app-footer';
import { Header as AuthenticatedHeader, PublicHeader } from '~/components/general/app-header';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/_layout';

export function meta() {
  return appMetaTags('Profile');
}

export default function PublicProfileLayout() {
  const { sessionData } = useOptionalSession();

  return (
    <div className="flex min-h-screen flex-col">
      {sessionData ? <AuthenticatedHeader /> : <PublicHeader />}

      <main className="my-8 flex-1 px-4 md:my-12 md:px-8">
        <Outlet />
      </main>

      <AppFooter />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const errorCode = isRouteErrorResponse(error) ? error.status : 500;

  const errorCodeMap = {
    404: {
      subHeading: msg`404 Profile not found`,
      heading: msg`Oops! Something went wrong.`,
      message: msg`The profile you are looking for could not be found.`,
    },
  };

  return (
    <GenericErrorLayout
      errorCode={errorCode}
      errorCodeMap={errorCodeMap}
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
