import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/requireAdminSession';
import AppSidebar from '@/components/Sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

// Server Component gate — the real check for every /dashboard/* page. Runs
// on the server before anything renders, so there's no flash of protected
// content and no separate client round trip needed the way a
// localStorage-flag gate (see lucira-admin's own AdminAuthGate.jsx) would
// require. requireAdminSession() (used by the API routes) is the other half
// of this same boundary — this protects the PAGES, that protects the DATA.
export default async function DashboardLayout({ children }) {
  const session = await getAdminSession();
  if (!session) redirect('/login');

  // The sidebar writes its own open/closed cookie (ui/sidebar.jsx); reading
  // it here keeps a collapsed sidebar collapsed across page loads.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        {/* Menu button on every size: a phone opens the sheet, a tablet or
            laptop collapses the sidebar to give wide tables the full width. */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:px-6">
          <SidebarTrigger className="size-10 md:size-9" />
          {/* Desktop already shows the name at the top of the sidebar. */}
          <Separator orientation="vertical" className="h-5 md:hidden" />
          <span className="text-sm font-semibold md:hidden">Lucira POS Admin</span>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-6 2xl:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
