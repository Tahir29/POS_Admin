'use client';

// Thin wrapper around the official datatables.net React binding — chosen
// over TanStack Table specifically for its Responsive extension: columns
// collapse into an expandable "+" detail row on narrow screens instead of
// forcing horizontal scroll, which is what "fully responsive" datatables
// actually means for wide DB records like these (many fields, on a phone).
//
// `columns` follows DataTables' own column-definition shape
// ({ title, data, render? }), not a JSX-per-cell renderer — data is already
// normalized server-side by the time it gets here, so a declarative column
// map is all each view needs.

import DataTableCore from 'datatables.net-react';
import DT from 'datatables.net-dt';
import 'datatables.net-responsive-dt';

DataTableCore.use(DT);

/**
 * @param {{ data: object[], columns: object[] }} props
 */
export default function DataTable({ data, columns }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
      <DataTableCore
        data={data}
        columns={columns}
        className="display w-full"
        options={{
          responsive: true,
          pageLength: 25,
          lengthMenu: [10, 25, 50, 100],
        }}
      />
    </div>
  );
}
