'use client';

// Function-valued `render` entries in COLUMNS can't cross a Server->Client
// Component boundary (Next.js can't serialize a plain function as a prop) —
// this page has to be a Client Component itself so COLUMNS is defined and
// consumed on the same side of that boundary as RemoteDataTable.
import RemoteDataTable from '@/components/RemoteDataTable';
import { money, dateTime, dash, journeyHref } from '@/lib/format';

const COLUMNS = [
  { title: 'Customer', data: 'customerName', render: dash, responsivePriority: 1, href: (row) => journeyHref(row.customerMobile) },
  { title: 'Mobile', data: 'customerMobile', render: dash, responsivePriority: 4 },
  {
    title: 'Store',
    data: 'storeName',
    render: (name, type, row) => (name ? `${name} (#${row.companyId})` : dash(row.companyId)),
    responsivePriority: 2,
  },
  { title: 'Items', data: 'itemCount' },
  { title: 'Subtotal', data: 'subtotal', render: money },
  { title: 'Tax', data: 'taxAmount', render: money },
  { title: 'Total', data: 'total', render: money, responsivePriority: 3 },
  { title: 'Last Updated', data: 'updatedAt', render: dateTime },
];

export default function AbandonedCartsPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Abandoned Carts</h1>
      <p className="mb-4 text-sm text-muted-foreground md:mb-6">
        Every unfinished cart currently saved per customer, across all stores.
      </p>
      <RemoteDataTable endpoint="/api/abandoned-carts" columns={COLUMNS} />
    </div>
  );
}
