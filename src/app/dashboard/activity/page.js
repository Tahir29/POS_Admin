'use client';

// See abandoned-carts/page.js's identical comment — function-valued
// `render` entries in COLUMNS require this to be a Client Component.
import { Suspense } from 'react';
import FilterBar from '@/components/FilterBar';
import RemoteDataTable from '@/components/RemoteDataTable';
import { useFilters } from '@/hooks/use-filters';
import { customerDayHref, dateTime, dash, money } from '@/lib/format';

const COLUMNS = [
  { title: 'Event', data: 'event', responsivePriority: 1 },
  { title: 'Time', data: 'at', render: dateTime, responsivePriority: 2 },
  {
    title: 'Store',
    data: 'store',
    render: (v, type, row) => (v ? `${v}${row.storeInferred ? ' (inferred)' : ''}` : '—'),
  },
  { title: 'Store Login', data: 'login', render: dash },
  {
    title: 'Customer',
    data: 'customer',
    render: dash,
    href: (row) => customerDayHref(row.mobile, row.at),
  },
  { title: 'Details', data: 'detail', render: dash },
  { title: 'Amount', data: 'amount', render: (v) => (v == null ? '—' : money(v)) },
];

function ActivityTable() {
  const { query } = useFilters();
  return (
    <RemoteDataTable
      endpoint={`/api/activity${query ? `?${query}` : ''}`}
      columns={COLUMNS}
      emptyMessage="Nothing recorded for this store and period."
    />
  );
}

export default function ActivityLogPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Activity Log</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Every recorded POS event as a searchable table. Tap a customer to see their journey.
      </p>
      <Suspense>
        <FilterBar />
        <ActivityTable />
      </Suspense>
    </div>
  );
}
