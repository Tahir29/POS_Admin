'use client';

// See abandoned-carts/page.js's identical comment — function-valued
// `render` entries in COLUMNS require this to be a Client Component.
import RemoteDataTable from '@/components/RemoteDataTable';
import { dateTime, dash, journeyHref } from '@/lib/format';

const COLUMNS = [
  { title: 'Customer', data: 'customerName', render: dash, responsivePriority: 1, href: (row) => journeyHref(row.customerMobile) },
  { title: 'Mobile', data: 'customerMobile', render: dash, responsivePriority: 3 },
  { title: 'Items', data: 'itemCount', responsivePriority: 2 },
  { title: 'Last Updated', data: 'updatedAt', render: dateTime },
];

export default function WishlistPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Wishlist</h1>
      <p className="mb-4 text-sm text-muted-foreground md:mb-6">
        Every customer&apos;s currently saved wishlist, across all stores.
      </p>
      <RemoteDataTable endpoint="/api/wishlist" columns={COLUMNS} />
    </div>
  );
}
