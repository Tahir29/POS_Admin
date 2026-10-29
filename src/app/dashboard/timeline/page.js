'use client';

// What each store's team did on the POS, in order — login, walk-ins,
// products shown, carts, sales, logout/timeouts. Date range defaults to
// today; pick one store or see all stores interleaved.

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FilterBar from '@/components/FilterBar';
import Timeline from '@/components/Timeline';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFilters } from '@/hooks/use-filters';

function TeamTimeline() {
  const router = useRouter();
  const { from, to, store } = useFilters();
  const key = `${from}|${to}|${store}`;
  // Each result remembers the filters it was loaded for, so changing a filter
  // shows "loading" without resetting state inside the effect.
  const [result, setResult] = useState(null); // { key, data } | { key, error }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/activity?from=${from}&to=${to}${store ? `&store=${store}` : ''}`)
      .then((res) => {
        if (res.status === 401) { router.replace('/login'); return null; }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((d) => { if (!cancelled && d) setResult({ key, data: d }); })
      .catch(() => { if (!cancelled) setResult({ key, error: 'Could not load the timeline.' }); });
    return () => { cancelled = true; };
  }, [key, from, to, store, router]);

  const current = result?.key === key ? result : null;
  const data = current?.data;
  if (current?.error) return <Card><CardContent className="text-sm text-destructive">{current.error}</CardContent></Card>;
  if (!data) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }
  if (!data.rows.length) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Nothing recorded {store ? 'for this store ' : ''}in this period.
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      {data.truncated && (
        <p className="mb-3 text-sm text-status-made-order">Showing the latest 5,000 events — pick a shorter period to see everything.</p>
      )}
      <Timeline events={data.rows} showStore={!store} />
    </>
  );
}

export default function TeamTimelinePage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Team Timeline</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Everything a store&apos;s team did on the POS, in order — from login to logout.
      </p>
      <Suspense>
        <FilterBar />
        <TeamTimeline />
      </Suspense>
    </div>
  );
}
