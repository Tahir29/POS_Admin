'use client';

// See abandoned-carts/page.js's identical comment — function-valued
// `render` entries in COLUMNS require this to be a Client Component.
import { Suspense } from 'react';
import FilterBar from '@/components/FilterBar';
import RemoteDataTable from '@/components/RemoteDataTable';
import { useFilters } from '@/hooks/use-filters';
import { dash, duration, money } from '@/lib/format';

const day = (d) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const time = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }) : '—');

const COLUMNS = [
  {
    title: 'Store',
    data: 'store',
    responsivePriority: 1,
    href: (row) => `/dashboard/timeline?from=${row.day}&to=${row.day}&store=${row.companyId}`,
  },
  { title: 'Status', data: 'status', responsivePriority: 2 },
  { title: 'Date', data: 'day', render: day },
  { title: 'Login ID', data: 'loginIds', render: dash },
  { title: 'First Login', data: 'firstLogin', render: time },
  {
    title: 'Last Logout',
    data: 'lastLogout',
    render: (v, type, row) => (row.stillActive ? 'Still logged in' : time(v)),
  },
  { title: 'Logged In For', data: 'loggedInMs', render: (v) => (v ? duration(v) : '—') },
  { title: 'Logins', data: 'logins' },
  {
    title: 'Sessions Ended',
    data: 'timedOut',
    render: (v, type, row) =>
      [
        row.signedOut && `${row.signedOut} signed out`,
        row.timedOut && `${row.timedOut} timed out`,
        row.failed && `${row.failed} failed login${row.failed === 1 ? '' : 's'}`,
      ].filter(Boolean).join(' · ') || '—',
  },
  {
    title: 'Sales',
    data: 'sales',
    render: (v, type, row) => (v ? `${money(v)} (${row.invoices} invoice${row.invoices === 1 ? '' : 's'})` : '—'),
  },
];

function StoreActivityTable() {
  const { query } = useFilters();
  return (
    <RemoteDataTable
      endpoint={`/api/store-activity${query ? `?${query}` : ''}`}
      columns={COLUMNS}
      emptyMessage="No stores to show for this period."
    />
  );
}

export default function StoreActivityPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Store Activity</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Each store&apos;s POS day — first login, last logout, hours logged in, how sessions ended, and
        invoiced sales. Tap a store to see its timeline.
      </p>
      <Suspense>
        <FilterBar />
        <StoreActivityTable />
      </Suspense>
    </div>
  );
}
