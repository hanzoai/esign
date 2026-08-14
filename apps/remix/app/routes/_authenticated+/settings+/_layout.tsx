import { Trans } from '@lingui/react/macro';
import { Outlet } from 'react-router';

import { PageHeader } from '~/components/general/page-header';
import { SettingsDesktopNav } from '~/components/general/settings-nav-desktop';
import { SettingsMobileNav } from '~/components/general/settings-nav-mobile';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Settings');
}

export default function SettingsLayout() {
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <PageHeader title={<Trans>Settings</Trans>} />

      <div className="mt-4 grid grid-cols-12 gap-x-8 md:mt-8">
        <SettingsDesktopNav className="hidden md:col-span-3 md:flex" />
        <SettingsMobileNav className="col-span-12 mb-8 md:hidden" />

        <div className="col-span-12 md:col-span-9">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
