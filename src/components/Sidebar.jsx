'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

// One entry per data source. Add a new one here + its own
// src/app/dashboard/<slug>/page.js when a new collection/report is wired up
// — nothing else needs touching to add it to the nav.
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/abandoned-carts', label: 'Abandoned Carts' },
  { href: '/dashboard/wishlist', label: 'Wishlist' },
  { href: '/dashboard/recently-viewed', label: 'Recently Viewed' },
  { href: '/dashboard/customers', label: 'Customer Profiles' },
  { href: '/dashboard/walk-ins', label: 'Customer Walk-Ins' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  return (
    <>
      {/* Mobile top bar — sidebar becomes a horizontal scroller under md */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-white px-4 py-3 md:hidden">
        <span className="text-sm font-semibold">Lucira POS Admin</span>
        <button onClick={handleLogout} className="text-xs text-gray-500 underline">
          Sign out
        </button>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-white px-2 py-2 md:w-60 md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:px-3 md:py-6">
        <div className="mb-4 hidden px-2 text-sm font-semibold md:block">Lucira POS Admin</div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-[var(--accent)]/10 font-medium text-[var(--accent)]'
                  : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="mt-4 hidden shrink-0 rounded-lg px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100 md:block"
        >
          Sign out
        </button>
      </nav>
    </>
  );
}
