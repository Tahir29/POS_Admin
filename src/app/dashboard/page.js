'use client';

// The dashboard is the store board and nothing else: every store, and for the
// chosen day (default today) whether it logged in to the POS, when, and
// whether it's still logged in. Same numbers as Store Activity (both read
// /api/store-activity → lib/storeDays.js).

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, RefreshCw } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFilters } from '@/hooks/use-filters';
import { money } from '@/lib/format';

const REFRESH_MS = 60 * 1000;
const IST = { timeZone: 'Asia/Kolkata' };
const time = (iso) => new Date(iso).toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', minute: '2-digit' });
const dayTitle = (day) => new Date(`${day}T00:00:00+05:30`).toLocaleDateString('en-IN', { ...IST, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const ORDER = { 'Logged in now': 0, 'Logged out': 1, 'Not logged in': 2 };
const END_LABEL = { manual: 'signed out', idle_timeout: 'timed out' };

function StatusBadge({ status }) {
  if (status === 'Logged in now') {
    return (
      <Badge className="gap-1.5 bg-status-in-stock/10 text-status-in-stock">
        <span className="size-1.5 rounded-full bg-status-in-stock" aria-hidden /> Logged in
      </Badge>
    );
  }
  if (status === 'Logged out') return <Badge variant="secondary">Logged out</Badge>;
  return <Badge variant="outline" className="border-destructive/30 text-destructive">Not logged in</Badge>;
}

function StoreCard({ row, timelineHref }) {
  const loggedIn = row.status !== 'Not logged in';
  return (
    <Card size="sm" className={loggedIn ? '' : 'bg-muted/30'}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="leading-snug">{row.isHeadOffice ? 'Head Office (admin login)' : row.store}</CardTitle>
          {row.isHeadOffice && <p className="mt-0.5 text-xs text-muted-foreground">{row.store}</p>}
        </div>
        <StatusBadge status={row.status} />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {loggedIn ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Logged in</dt>
            <dd className="font-medium tabular-nums">{time(row.firstLogin)}</dd>
            <dt className="text-muted-foreground">{row.stillActive ? 'Now' : 'Logged out'}</dt>
            <dd className="font-medium tabular-nums">
              {row.stillActive ? 'Still logged in' : time(row.lastLogout)}
              {!row.stillActive && row.lastLogoutReason && (
                <span className="font-normal text-muted-foreground"> · {END_LABEL[row.lastLogoutReason]}</span>
              )}
            </dd>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No POS login on this day</p>
        )}
        {/* Total only — the breakdown lives on the Store Sales page. */}
        <div className="flex items-baseline justify-between gap-3 border-t pt-2">
          <span className="text-sm text-muted-foreground">Total sales</span>
          <span className={row.sales ? 'text-base font-semibold tabular-nums' : 'text-sm text-muted-foreground'}>
            {row.sales ? money(row.sales) : 'No sales'}
          </span>
        </div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
          <Link href={timelineHref}>
            View timeline <ChevronRight />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function StoreBoard() {
  const router = useRouter();
  const { to, store, isToday } = useFilters();
  const key = `${to}|${store}`;
  // Each result remembers the filters it was loaded for, so changing the day
  // or store shows "loading" without resetting state inside the effect.
  const [result, setResult] = useState(null); // { key, rows, updatedAt } | { key, error }

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/store-activity?from=${to}&to=${to}${store ? `&store=${store}` : ''}`)
        .then((res) => {
          if (res.status === 401) { router.replace('/login'); return null; }
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((d) => { if (!cancelled && d) setResult({ key, rows: d.rows ?? [], updatedAt: new Date() }); })
        // A failed background refresh keeps the last good board on screen.
        .catch(() => { if (!cancelled) setResult((prev) => (prev?.key === key && prev.rows ? prev : { key, error: 'Could not load the store board.' })); });

    load();
    // Only today's board can change, so only today's refreshes itself.
    const timer = isToday ? setInterval(load, REFRESH_MS) : null;
    return () => { cancelled = true; clearInterval(timer); };
  }, [key, to, store, isToday, router]);

  const current = result?.key === key ? result : null;
  const rows = current?.rows ?? null;
  const error = current?.error ?? null;
  const updatedAt = current?.updatedAt ?? null;

  const stores = (rows ?? []).filter((r) => !r.isHeadOffice);
  // Logged in first, then logged out, then not logged in; Head Office (the
  // admin login, not a store counter) always last.
  const sorted = [...(rows ?? [])].sort(
    (a, b) => Number(a.isHeadOffice) - Number(b.isHeadOffice) || ORDER[a.status] - ORDER[b.status] || a.store.localeCompare(b.store)
  );
  const loggedInCount = stores.filter((r) => r.status !== 'Not logged in').length;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold">{dayTitle(to)}</h2>
        {rows && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-live="polite">
            <span>
              <span className="font-semibold text-foreground">{loggedInCount}</span> of {stores.length} stores logged in
            </span>
            {isToday && updatedAt && (
              <span className="inline-flex items-center gap-1">
                · <RefreshCw className="size-3" aria-hidden /> updated {time(updatedAt)}
              </span>
            )}
          </p>
        )}
      </div>

      {error && <Card><CardContent className="text-sm text-destructive">{error}</CardContent></Card>}

      {!error && rows === null && (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      )}

      {rows && (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {sorted.map((r) => (
            <StoreCard key={r.id} row={r} timelineHref={`/dashboard/timeline?from=${to}&to=${to}&store=${r.companyId}`} />
          ))}
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Store Login Board</h1>
      <p className="mb-4 text-sm text-muted-foreground">Which stores are on the POS, and since when.</p>
      <Suspense>
        <FilterBar mode="day" />
        <StoreBoard />
      </Suspense>
    </div>
  );
}
