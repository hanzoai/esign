import { Outlet } from 'react-router';

export default function Layout() {
  return (
    <main className="flex min-h-screen w-full flex-col bg-black text-white">
      <Outlet />
    </main>
  );
}
