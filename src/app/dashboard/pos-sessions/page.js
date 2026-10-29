'use client';

// See abandoned-carts/page.js's identical comment — function-valued
// `render` entries in COLUMNS require this to be a Client Component.
import { Suspense } from 'react';
import FilterBar from '@/components/FilterBar';
import RemoteDataTable from '@/components/RemoteDataTable';
import { useFilters } from '@/hooks/use-filters';
import { dateTime, dash, duration } from '@/lib/format';

const COLUMNS = [
  { title: 'Store', data: 'store', render: dash, responsivePriority: 1 },
  {
    title: 'Status',
    data: 'status',
    render: (status, type, row) => (row.failureCode ? `${status} (${row.failureCode})` : status),
    responsivePriority: 2,
  },
  { title: 'Login ID', data: 'username', render: dash },
  { title: 'Logged In', data: 'loginAt', render: dateTime },
  { title: 'Logged Out', data: 'endedAt', render: dateTime },
  { title: 'Duration', data: 'durationMs', render: duration },
  { title: 'Last Activity', data: 'lastActivityAt', render: dateTime },
  { title: 'Device / IP', data: 'device', render: (v, type, row) => [v, row.ip].filter(Boolean).join(' · ') },
];

function SessionsTable() {
  const { query } = useFilters();
  return (
    <RemoteDataTable
      endpoint={`/api/pos-sessions${query ? `?${query}` : ''}`}
      columns={COLUMNS}
      emptyMessage="No POS logins for this store and period."
    />
  );
}

export default function PosSessionsPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">POS Sessions</h1>
      <p className="mb-4 text-sm text-muted-foreground md:mb-6">
        Every store login — when it started, how it ended, and how long it lasted. Failed attempts
        included.
      </p>
      <Suspense>
        <FilterBar />
        <SessionsTable />
      </Suspense>
    </div>
  );
}
