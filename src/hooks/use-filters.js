'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// The admin-wide filters live in the URL (?from=&to=&store=) so they survive
// page changes, reloads and shared links — read the same way server-side by
// lib/dayRange.js. Defaults: today, all stores.

const IST_MS = 5.5 * 60 * 60 * 1000;
export const istToday = () => new Date(Date.now() + IST_MS).toISOString().slice(0, 10);
export const istDaysAgo = (n) => new Date(Date.now() + IST_MS - n * 86400000).toISOString().slice(0, 10);

const FILTER_KEYS = ['from', 'to', 'store'];

export function useFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const today = istToday();
  const to = params.get('to') || today;
  const from = params.get('from') || to;
  const store = params.get('store') || '';

  // Only the filter keys, so it can be appended to API calls and nav links.
  const query = useMemo(() => {
    const q = new URLSearchParams();
    for (const k of FILTER_KEYS) if (params.get(k)) q.set(k, params.get(k));
    return q.toString();
  }, [params]);

  const setFilters = useCallback((next) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    // Today is the default — keep URLs clean when that's what's selected.
    if (q.get('to') === today) q.delete('to');
    if (q.get('from') === (q.get('to') || today)) q.delete('from');
    router.replace(q.toString() ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [params, pathname, router, today]);

  return { from, to, store, query, isToday: from === today && to === today, setFilters };
}
