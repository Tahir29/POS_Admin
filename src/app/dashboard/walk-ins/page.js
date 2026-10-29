'use client';

// See abandoned-carts/page.js's identical comment — function-valued
// `render` entries in COLUMNS require this to be a Client Component.
import { Suspense } from 'react';
import FilterBar from '@/components/FilterBar';
import RemoteDataTable from '@/components/RemoteDataTable';
import { useFilters } from '@/hooks/use-filters';
import { dateTime, dash, journeyHref } from '@/lib/format';

const COLUMNS = [
  { title: 'Customer', data: 'customerName', render: dash, responsivePriority: 1, href: (row) => journeyHref(row.mobile) },
  { title: 'Mobile', data: 'mobile', render: dash },
  { title: 'Email', data: 'email', render: dash },
  { title: 'Store', data: 'store', render: dash, responsivePriority: 2 },
  { title: 'Source', data: 'source', render: dash },
  { title: 'Visit Date', data: 'date', render: dateTime, responsivePriority: 3 },
];

function WalkInsTable() {
  const { query } = useFilters();
  return (
    <RemoteDataTable
      endpoint={`/api/walk-ins${query ? `?${query}` : ''}`}
      columns={COLUMNS}
      emptyMessage="No walk-ins recorded for this store and period."
    />
  );
}

export default function WalkInsPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Customer Walk-Ins</h1>
      <p className="mb-4 text-sm text-muted-foreground md:mb-6">
        Every store visit recorded in OrnaVerse when a POS counter looks up a customer.
      </p>
      <Suspense>
        <FilterBar />
        <WalkInsTable />
      </Suspense>
    </div>
  );
}
