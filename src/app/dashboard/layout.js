import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/requireAdminSession';
import Sidebar from '@/components/Sidebar';

// Server Component gate — the real check for every /dashboard/* page. Runs
// on the server before anything renders, so there's no flash of protected
// content and no separate client round trip needed the way a
// localStorage-flag gate (see lucira-admin's own AdminAuthGate.jsx) would
// require. requireAdminSession() (used by the API routes) is the other half
// of this same boundary — this protects the PAGES, that protects the DATA.
export default async function DashboardLayout({ children }) {
  const session = await getAdminSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
