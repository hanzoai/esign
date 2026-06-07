import { useLingui } from '@lingui/react/macro';

import { OrganisationEmailDomainCreateDialog } from '~/components/dialogs/organisation-email-domain-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { OrganisationEmailDomainsDataTable } from '~/components/tables/organisation-email-domains-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Email Domains');
}

export default function OrganisationSettingsEmailDomains() {
  const { t } = useLingui();

  return (
    <div>
      <SettingsHeader
        title={t`Email Domains`}
        subtitle={t`Here you can add email domains to your organisation.`}
      >
        <OrganisationEmailDomainCreateDialog />
      </SettingsHeader>

      <section>
        <OrganisationEmailDomainsDataTable />
      </section>
    </div>
  );
}
