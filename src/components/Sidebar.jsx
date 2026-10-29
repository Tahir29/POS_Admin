'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Activity, Eye, Footprints, GanttChart, Heart, History, IndianRupee, LayoutDashboard, LogIn, LogOut, Route, ShoppingCart, Store, Users,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

// `filtered` pages follow the admin-wide date/store filter (hooks/use-filters),
// so their links carry the current ?from=&to=&store= along — switching page
// keeps what you were looking at. Customer pages aren't date/store based.
const NAV_GROUPS = [
  {
    label: 'Stores & team',
    filtered: true,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/dashboard/timeline', label: 'Team Timeline', icon: GanttChart },
      { href: '/dashboard/sales', label: 'Store Sales', icon: IndianRupee },
      { href: '/dashboard/activity', label: 'Activity Log', icon: Activity },
      { href: '/dashboard/changes', label: 'Change Log', icon: History },
      { href: '/dashboard/store-activity', label: 'Store Activity', icon: Store },
      { href: '/dashboard/pos-sessions', label: 'POS Sessions', icon: LogIn },
      { href: '/dashboard/walk-ins', label: 'Walk-Ins', icon: Footprints },
    ],
  },
  {
    label: 'Customers',
    filtered: false,
    items: [
      { href: '/dashboard/journey', label: 'Customer Timeline', icon: Route },
      { href: '/dashboard/abandoned-carts', label: 'Abandoned Carts', icon: ShoppingCart },
      { href: '/dashboard/wishlist', label: 'Wishlist', icon: Heart },
      { href: '/dashboard/recently-viewed', label: 'Recently Viewed', icon: Eye },
      { href: '/dashboard/customers', label: 'Customer Profiles', icon: Users },
    ],
  },
];

function NavMenu({ query }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return NAV_GROUPS.map((group) => (
    <SidebarGroup key={group.label}>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map(({ href, label, icon: Icon }) => (
            <SidebarMenuItem key={href}>
              {/* Sub-pages (e.g. one customer's journey) keep their section highlighted. */}
              <SidebarMenuButton asChild isActive={pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))}>
                {/* On mobile the sidebar is a Sheet — close it once a page is picked. */}
                <Link href={group.filtered && query ? `${href}?${query}` : href} onClick={() => setOpenMobile(false)}>
                  <Icon />
                  <span>{label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}

function NavMenuWithFilters() {
  const params = useSearchParams();
  const q = new URLSearchParams();
  for (const k of ['from', 'to', 'store']) if (params.get(k)) q.set(k, params.get(k));
  return <NavMenu query={q.toString()} />;
}

export default function AppSidebar() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <span className="text-base font-semibold tracking-tight">Lucira POS Admin</span>
      </SidebarHeader>
      <SidebarContent>
        {/* Reading the URL needs a Suspense boundary; the fallback is the same menu without filters. */}
        <Suspense fallback={<NavMenu query="" />}>
          <NavMenuWithFilters />
        </Suspense>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
