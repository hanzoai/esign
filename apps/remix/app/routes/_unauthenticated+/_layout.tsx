import { Outlet } from 'react-router';

import { AppFooter } from '~/components/general/app-footer';
import { PublicHeader } from '~/components/general/app-header';

export default function Layout() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <PublicHeader />

      <main className="flex w-full flex-1 flex-col items-center justify-center px-4 py-12 md:py-16">
        <Outlet />
      </main>

      <AppFooter />
    </div>
  );
}
