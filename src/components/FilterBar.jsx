'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { istDaysAgo, istToday, useFilters } from '@/hooks/use-filters';

// The admin-wide date + store filter. `mode="day"` picks one day (dashboard);
// `mode="range"` picks from/to. Both default to today and all stores, and
// write to the URL via useFilters so every page shares the same selection.

let storesPromise = null;
const loadStores = () => {
  storesPromise ??= fetch('/api/stores')
    .then((res) => (res.ok ? res.json() : { rows: [] }))
    .then((d) => d.rows ?? [])
    .catch(() => {
      storesPromise = null;
      return [];
    });
  return storesPromise;
};

const ALL = 'all';

export default function FilterBar({ mode = 'range' }) {
  const { from, to, store, setFilters } = useFilters();
  const [stores, setStores] = useState([]);

  useEffect(() => {
    let cancelled = false;
    loadStores().then((rows) => { if (!cancelled) setStores(rows); });
    return () => { cancelled = true; };
  }, []);

  const today = istToday();
  const yesterday = istDaysAgo(1);
  const presets = [
    { label: 'Today', from: today, to: today },
    { label: 'Yesterday', from: yesterday, to: yesterday },
    ...(mode === 'range' ? [{ label: 'Last 7 days', from: istDaysAgo(6), to: today }] : []),
  ];

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end md:mb-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Quick pick</span>
        <div className="flex gap-1.5" role="group" aria-label="Quick date range">
          {presets.map((p) => {
            const active = p.from === from && p.to === to;
            return (
              <Button
                key={p.label}
                type="button"
                size="sm"
                variant={active ? 'default' : 'outline'}
                aria-pressed={active}
                className="h-9 flex-1 sm:flex-none"
                onClick={() => setFilters({ from: p.from, to: p.to })}
              >
                {p.label}
              </Button>
            );
          })}
        </div>
      </div>

      {mode === 'day' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-day" className="text-xs text-muted-foreground">Date</Label>
          <Input
            id="filter-day"
            type="date"
            value={to}
            max={today}
            onChange={(e) => e.target.value && setFilters({ from: e.target.value, to: e.target.value })}
            className="h-9 sm:w-40"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-from" className="text-xs text-muted-foreground">From</Label>
            <Input
              id="filter-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => e.target.value && setFilters({ from: e.target.value, to })}
              className="h-9 sm:w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-to" className="text-xs text-muted-foreground">To</Label>
            <Input
              id="filter-to"
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => e.target.value && setFilters({ from: e.target.value < from ? e.target.value : from, to: e.target.value })}
              className="h-9 sm:w-40"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 sm:min-w-56 sm:flex-1 lg:max-w-xs">
        <span id="filter-store-label" className="text-xs font-medium text-muted-foreground">Store</span>
        <Select value={store || ALL} onValueChange={(v) => setFilters({ store: v === ALL ? '' : v })}>
          <SelectTrigger className="h-9 w-full" aria-labelledby="filter-store-label">
            <SelectValue placeholder="All stores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stores</SelectItem>
            {stores.map((s) => (
              <SelectItem key={s.companyId} value={String(s.companyId)}>
                {s.name}{s.isHeadOffice ? ' (Head Office)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
