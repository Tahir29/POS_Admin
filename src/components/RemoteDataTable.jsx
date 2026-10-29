'use client';

// Fetch-then-render wrapper shared by every dashboard view — extracted once
// three views started needing the identical loading/error/DataTable
// boilerplate (see the individual page.js files for how thin they are now).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DataTable from '@/components/DataTable';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * @param {{ endpoint: string, columns: object[], emptyMessage?: string }} props
 */
export default function RemoteDataTable({ endpoint, columns, emptyMessage }) {
  const router = useRouter();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(endpoint)
      .then((res) => {
        // A 7-day session cookie CAN expire mid-browse, not just between
        // visits — the dashboard layout's server-side redirect
        // (DashboardLayout) only ever runs on a fresh page load, so a
        // fetch made from an already-open tab needs its own check here.
        // Without this, an expired session just showed a generic "Failed
        // to load" with no way back to /login short of a manual refresh.
        if (res.status === 401) {
          router.replace('/login');
          return null;
        }
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => { if (!cancelled && data) setRows(data.rows ?? []); })
      .catch(() => { if (!cancelled) setError('Failed to load this data.'); });
    return () => { cancelled = true; };
  }, [endpoint, router]);

  if (error) {
    return (
      <Card>
        <CardContent className="text-sm text-destructive">{error}</CardContent>
      </Card>
    );
  }
  if (rows === null) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">{emptyMessage ?? 'No records found.'}</CardContent>
      </Card>
    );
  }
  return <DataTable data={rows} columns={columns} />;
}
