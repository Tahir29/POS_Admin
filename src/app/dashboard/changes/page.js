'use client';

// The admin's permanent change log (lib/collector.js): everything the POS
// overwrites or deletes — carts cleared without a sale, items removed, bills
// cancelled or edited, customer details changed — kept here for good.

import { Suspense, useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import RemoteDataTable from '@/components/RemoteDataTable';
import { Button } from '@/components/ui/button';
import { useFilters } from '@/hooks/use-filters';
import { customerDayHref, dash, dateTime, money } from '@/lib/format';

const COLUMNS = [
  { title: 'Change', data: 'event', responsivePriority: 1 },
  { title: 'Time', data: 'at', render: dateTime, responsivePriority: 2 },
  { title: 'Store', data: 'store', render: (v, t, r) => (v ? `${v}${r.storeInferred ? ' (inferred)' : ''}` : '—') },
  { title: 'Customer', data: 'customer', render: dash, href: (r) => customerDayHref(r.mobile, r.at) },
  { title: 'Details', data: 'detail', render: dash },
  { title: 'Amount', data: 'amount', render: (v) => (v == null ? '—' : money(v)) },
];

const time = (iso) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });

function CollectorStatus({ onChecked }) {
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  const loadStatus = useCallback(
    () => fetch('/api/collector-status').then((r) => (r.ok ? r.json() : null)).then((d) => d && setStatus(d)).catch(() => {}),
    []
  );
  useEffect(() => { loadStatus(); }, [loadStatus]);

  const checkNow = async () => {
    setChecking(true);
    try {
      await fetch('/api/collect', { method: 'POST' });
      await loadStatus();
      onChecked();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
      <span aria-live="polite">
        {status?.lastRunAt ? `Last checked ${time(status.lastRunAt)} — checks every minute while the admin is open.` : 'Not checked yet.'}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={checkNow} disabled={checking}>
        <RefreshCw className={checking ? 'animate-spin' : undefined} /> {checking ? 'Checking…' : 'Check now'}
      </Button>
    </div>
  );
}

function ChangesTable() {
  const { query } = useFilters();
  const [refresh, setRefresh] = useState(0);
  return (
    <>
      <CollectorStatus onChecked={() => setRefresh((n) => n + 1)} />
      <RemoteDataTable
        key={refresh}
        endpoint={`/api/activity?only=changes${query ? `&${query}` : ''}`}
        columns={COLUMNS}
        emptyMessage="No changes recorded for this store and period."
      />
    </>
  );
}

export default function ChangeLogPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Change Log</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        What the POS overwrites or deletes, kept here permanently — carts cleared without a sale, items
        removed, bills cancelled or edited, payments received, customer details changed.
      </p>
      <Suspense>
        <FilterBar />
        <ChangesTable />
      </Suspense>
    </div>
  );
}
