'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';

const money = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN') : '—');

const COLUMNS = [
  { title: 'Customer', data: 'customerName', render: (v) => v ?? '—' },
  { title: 'Mobile', data: 'customerMobile', render: (v) => v ?? '—' },
  { title: 'Store (company_id)', data: 'companyId', render: (v) => v ?? '—' },
  { title: 'Items', data: 'itemCount' },
  { title: 'Subtotal', data: 'subtotal', render: money },
  { title: 'Tax', data: 'taxAmount', render: money },
  { title: 'Total', data: 'total', render: money },
  { title: 'Last Updated', data: 'updatedAt', render: dateTime },
];

export default function AbandonedCartsPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/abandoned-carts')
      .then((res) => res.json())
      .then((data) => setRows(data.rows ?? []))
      .catch(() => setError('Failed to load abandoned carts.'));
  }, []);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Abandoned Carts</h1>
      <p className="mb-6 text-sm text-gray-500">
        Every unfinished cart currently saved per customer, across all stores.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && rows === null && <p className="text-sm text-gray-500">Loading…</p>}
      {rows && <DataTable data={rows} columns={COLUMNS} />}
    </div>
  );
}
