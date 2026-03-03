import { Trans } from '@lingui/react/macro';
import { Outlet, isRouteErrorResponse, useRouteError } from 'react-router';

import { EmbedAuthenticationRequired } from '~/components/embed/embed-authentication-required';
import { EmbedDocumentCompleted } from '~/components/embed/embed-document-completed';
import { EmbedDocumentRejected } from '~/components/embed/embed-document-rejected';
import { EmbedDocumentWaitingForTurn } from '~/components/embed/embed-document-waiting-for-turn';
import { EmbedPaywall } from '~/components/embed/embed-paywall';
import { EmbedRecipientExpired } from '~/components/embed/embed-recipient-expired';

import type { Route } from './+types/_layout';

// Todo: (RR7) Test
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const origin = loaderHeaders.get('Origin') ?? '*';

  // Allow third parties to iframe the document.
  return {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Origin': origin,
    'Content-Security-Policy': `frame-ancestors ${origin}`,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
  };
}

export default function Layout() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  console.log({ routeError: error });

  if (isRouteErrorResponse(error)) {
    if (error.status === 401 && error.data.type === 'embed-authentication-required') {
      return (
        <EmbedAuthenticationRequired email={error.data.email} returnTo={error.data.returnTo} />
      );
    }

    if (error.status === 403 && error.data.type === 'embed-paywall') {
      return <EmbedPaywall />;
    }

    if (error.status === 403 && error.data.type === 'embed-waiting-for-turn') {
      return <EmbedDocumentWaitingForTurn />;
    }

    if (error.status === 403 && error.data.type === 'embed-recipient-expired') {
      return <EmbedRecipientExpired />;
    }

    // !: Not used at the moment, may be removed in the future.
    if (error.status === 403 && error.data.type === 'embed-document-rejected') {
      return <EmbedDocumentRejected />;
    }

    // !: Not used at the moment, may be removed in the future.
    if (error.status === 403 && error.data.type === 'embed-document-completed') {
      return <EmbedDocumentCompleted name={error.data.name} signature={error.data.signature} />;
    }
  }

  return (
    <div>
      <Trans>Not Found</Trans>
    </div>
  );
}
