'use client';

// One customer's timeline — every recorded moment across every store, by
// day with times (components/Timeline.jsx, same as the Team Timeline).
//
// Date: ?day=YYYY-MM-DD (default TODAY) or ?day=all. The customer's whole
// history is loaded once (it's small) and filtered here, so switching days is
// instant and "last active" can always be offered.
//
// Keyed by mobile: everything the POS records is matched on the last 10
// digits (lib/activity.js), so customers sharing a number share a timeline —
// all names on the number are listed so that's visible.

import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useParams, useRouter, useSearchParams } from 'next/navigation';
import CustomerSearch from '@/components/CustomerSearch';
import Timeline from '@/components/Timeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { istDaysAgo, istToday } from '@/hooks/use-filters';
import { istDay } from '@/lib/dayRange';
import { money } from '@/lib/format';

const ALL = 'all';
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const FILTERS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'visits', label: 'Visits', match: (e) => e.kind === 'walk_in' },
  { key: 'browsing', label: 'Browsing', match: (e) => ['view', 'wishlist', 'wishlist_removed'].includes(e.kind) },
  { key: 'cart', label: 'Cart', match: (e) => e.kind === 'cart' || e.kind?.startsWith('cart_') },
  { key: 'sales', label: 'Sales', match: (e) => e.type === 'sale' || e.kind?.startsWith('bill_') },
  { key: 'changes', label: 'Changes', match: (e) => e.logged },
];

const longDay = (day) => new Date(`${day}T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDay = (iso) => new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });

function Summary({ events, allEvents, periodLabel }) {
  const count = (pred) => events.filter(pred).length;
  const spent = events.filter((e) => e.kind === 'invoice').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const first = allEvents.at(-1)?.at;
  const last = allEvents[0]?.at;
  const stats = [
    ['Store visits', count((e) => e.kind === 'walk_in')],
    ['Products viewed', count((e) => e.kind === 'view')],
    ['Invoices', count((e) => e.kind === 'invoice')],
    ['Total bought', spent ? money(Math.round(spent)) : '—'],
    ['First seen', first ? shortDay(first) : '—', 'all time'],
    ['Last seen', last ? shortDay(last) : '—', 'all time'],
  ];
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {stats.map(([label, value, scope]) => (
        <Card key={label} size="sm">
          <CardHeader>
            <CardDescription className="text-xs font-medium uppercase tracking-wide">{label}</CardDescription>
            <CardTitle><span className="text-lg font-semibold tabular-nums">{value}</span></CardTitle>
            <p className="text-xs text-muted-foreground">{scope ?? periodLabel}</p>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function DayPicker({ day, setDay }) {
  const today = istToday();
  const yesterday = istDaysAgo(1);
  const presets = [
    { label: 'Today', value: today },
    { label: 'Yesterday', value: yesterday },
    { label: 'All time', value: ALL },
  ];
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Show</span>
        <div className="flex gap-1.5" role="group" aria-label="Timeline period">
          {presets.map((p) => (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant={day === p.value ? 'default' : 'outline'}
              aria-pressed={day === p.value}
              className="h-9 flex-1 sm:flex-none"
              onClick={() => setDay(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="timeline-day" className="text-xs text-muted-foreground">Pick a date</Label>
        <Input
          id="timeline-day"
          type="date"
          value={day === ALL ? '' : day}
          max={today}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          className="h-9 sm:w-44"
        />
      </div>
    </div>
  );
}

function CustomerTimeline() {
  const { mobile } = useParams();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const pickedName = params.get('name');
  const today = istToday();
  const rawDay = params.get('day');
  const day = rawDay === ALL || DAY_RE.test(rawDay ?? '') ? rawDay : today;

  const [result, setResult] = useState(null); // { mobile, rows } | { mobile, error }
  const [filter, setFilter] = useState('all');

  const setDay = (value) => {
    const q = new URLSearchParams(params.toString());
    if (value === today) q.delete('day');
    else q.set('day', value);
    setFilter('all');
    router.replace(q.toString() ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/journey/${mobile}`)
      .then((res) => {
        if (res.status === 401) { router.replace('/login'); return null; }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((d) => { if (!cancelled && d) setResult({ mobile, rows: d.rows ?? [] }); })
      .catch(() => { if (!cancelled) setResult({ mobile, error: 'Failed to load this timeline.' }); });
    return () => { cancelled = true; };
  }, [mobile, router]);

  const current = result?.mobile === mobile ? result : null;
  const allEvents = useMemo(() => current?.rows ?? null, [current]);
  const names = useMemo(
    () => [...new Set((allEvents ?? []).map((e) => e.customer?.trim()).filter(Boolean))],
    [allEvents]
  );
  const dayEvents = useMemo(
    () => (allEvents ? (day === ALL ? allEvents : allEvents.filter((e) => istDay(e.at) === day)) : null),
    [allEvents, day]
  );

  const name = pickedName || names[0];
  const others = names.filter((n) => n.toLowerCase() !== name?.toLowerCase());
  const shown = dayEvents?.filter(FILTERS.find((f) => f.key === filter).match) ?? [];
  const periodLabel = day === ALL ? 'all time' : day === today ? 'today' : shortDay(`${day}T12:00:00+05:30`);
  const lastActiveDay = allEvents?.[0] ? istDay(allEvents[0].at) : null;

  return (
    <>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-semibold tracking-tight">{name ?? 'Customer Timeline'}</h1>
        <span className="text-sm tabular-nums text-muted-foreground">Mobile {mobile}</span>
      </div>
      {others.length > 0 && (
        <p className="mb-1 text-sm text-status-made-order">
          This number is also used by {others.join(', ')} — their activity is included.
        </p>
      )}
      <p className="mb-4 text-sm text-muted-foreground">
        {day === ALL ? 'Everything recorded for this customer across all stores, newest day first.' : `Everything this customer did on ${longDay(day)}.`}
      </p>

      <DayPicker day={day} setDay={setDay} />

      {current?.error && <Card><CardContent className="text-sm text-destructive">{current.error}</CardContent></Card>}

      {!current && (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      )}

      {allEvents?.length === 0 && (
        <Card><CardContent className="text-sm text-muted-foreground">Nothing recorded on the POS for this customer yet.</CardContent></Card>
      )}

      {allEvents?.length > 0 && dayEvents.length === 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">No activity on {longDay(day)}.</p>
            <div className="flex flex-wrap gap-2">
              {lastActiveDay && (
                <Button type="button" size="sm" onClick={() => setDay(lastActiveDay)}>
                  Last active: {shortDay(allEvents[0].at)}
                </Button>
              )}
              <Button type="button" size="sm" variant="outline" onClick={() => setDay(ALL)}>View all time</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {dayEvents?.length > 0 && (
        <>
          <Summary events={dayEvents} allEvents={allEvents} periodLabel={periodLabel} />
          <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Show events">
            {FILTERS.map((f) => {
              const n = dayEvents.filter(f.match).length;
              return (
                <Button
                  key={f.key}
                  type="button"
                  size="sm"
                  variant={filter === f.key ? 'default' : 'outline'}
                  aria-pressed={filter === f.key}
                  disabled={!n}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label} <span className="tabular-nums opacity-70">{n}</span>
                </Button>
              );
            })}
          </div>
          <Timeline events={shown} showCustomer={others.length > 0} />
        </>
      )}
    </>
  );
}

export default function CustomerTimelinePage() {
  return (
    <div>
      <CustomerSearch className="mb-5 max-w-xl" />
      <Suspense>
        <CustomerTimeline />
      </Suspense>
    </div>
  );
}
