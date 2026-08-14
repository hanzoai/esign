import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { BookIcon, HelpCircleIcon, Link2Icon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { useCurrentOrganisation } from '@hanzo/esign-lib/client-only/providers/organisation';
import { useSession } from '@hanzo/esign-lib/client-only/providers/session';
import { DOCS_URL } from '@hanzo/esign-lib/constants/app';
import { Button } from '@hanzo/esign-ui/primitives/button';

import { SupportTicketForm } from '~/components/forms/support-ticket-form';
import { PageHeader } from '~/components/general/page-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Support');
}

export default function SupportPage() {
  const [showForm, setShowForm] = useState(false);
  const { user } = useSession();
  const organisation = useCurrentOrganisation();

  const [searchParams] = useSearchParams();

  const teamId = searchParams.get('team');

  const handleSuccess = () => {
    setShowForm(false);
  };

  const handleCloseForm = () => {
    setShowForm(false);
  };

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <div className="mb-8">
        <PageHeader
          title={
            <span className="flex flex-row items-center gap-2">
              <HelpCircleIcon className="h-8 w-8 text-muted-foreground" />
              <Trans>Support</Trans>
            </span>
          }
          description={<Trans>Your current plan includes the following support channels:</Trans>}
        />

        <div className="mt-6 flex flex-col gap-4">
          <div className="rounded-lg border p-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <BookIcon className="h-5 w-5 text-muted-foreground" />
              <Link
                to={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                <Trans>Documentation</Trans>
              </Link>
            </h2>
            <p className="mt-1 text-muted-foreground">
              <Trans>Read our documentation to get started with Hanzo Sign.</Trans>
            </p>
          </div>
          {organisation && (
            <>
              <div className="rounded-lg border p-4">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Link2Icon className="h-5 w-5 text-muted-foreground" />
                  <Trans>Contact us</Trans>
                </h2>
                <p className="mt-1 text-muted-foreground">
                  <Trans>We'll get back to you as soon as possible via email.</Trans>
                </p>
                <div className="mt-4">
                  {!showForm ? (
                    <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                      <Trans>Create a support ticket</Trans>
                    </Button>
                  ) : (
                    <SupportTicketForm
                      organisationId={organisation.id}
                      teamId={teamId}
                      onSuccess={handleSuccess}
                      onClose={handleCloseForm}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
