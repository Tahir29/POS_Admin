'use client';

// See abandoned-carts/page.js's identical comment — function-valued
// `render` entries in COLUMNS require this to be a Client Component.
import RemoteDataTable from '@/components/RemoteDataTable';
import { dateTime, dash, journeyHref } from '@/lib/format';

// PAN is deliberately never mirrored into this collection at all (see
// lucira-pos's own customerProfile.js header) — nothing to redact here,
// it was never written in the first place.
const COLUMNS = [
  { title: 'Party ID', data: 'partyId' },
  { title: 'Name', data: 'name', render: dash, responsivePriority: 1, href: (row) => journeyHref(row.mobile) },
  { title: 'Mobile', data: 'mobile', render: dash, responsivePriority: 2 },
  { title: 'Email', data: 'email', render: dash },
  { title: 'City', data: 'city', render: dash },
  { title: 'State', data: 'state', render: dash },
  { title: 'Synced At', data: 'syncedAt', render: dateTime },
];

export default function CustomerProfilesPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Customer Profiles</h1>
      <p className="mb-4 text-sm text-muted-foreground md:mb-6">
        Customer records synced from OrnaVerse. PAN details are never stored here.
      </p>
      <RemoteDataTable endpoint="/api/customers" columns={COLUMNS} />
    </div>
  );
}
