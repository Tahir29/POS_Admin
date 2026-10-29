'use client';

// Type-ahead customer finder (shadcn Command): search every LIVE customer by
// any part of their name or mobile; picking one opens their timeline.
// Results come from /api/customer-search, so Command's own filtering is off.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

export default function CustomerSearch({ autoFocus = false, className = '' }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  // Each result remembers the term it was fetched for, so stale responses
  // never show against a newer query.
  const [result, setResult] = useState(null); // { term, rows, total } | { term, error }
  const term = query.trim();
  const active = term.length >= MIN_CHARS;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/customer-search?q=${encodeURIComponent(term)}`)
        .then((res) => {
          if (res.status === 401) { router.replace('/login'); return null; }
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((d) => { if (!cancelled && d) setResult({ term, rows: d.rows ?? [], total: d.total ?? 0 }); })
        .catch(() => { if (!cancelled) setResult({ term, error: true }); });
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [term, active, router]);

  const current = active && result?.term === term ? result : null;

  return (
    <Command
      shouldFilter={false}
      className={`h-auto rounded-xl border shadow-sm **:data-[slot=input-group]:h-11! ${className}`}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search by customer name or mobile…"
        aria-label="Search customers by name or mobile"
        autoFocus={autoFocus}
        // Fill the 44px box so the whole field is the tap target on phones.
        className="h-full text-base sm:text-sm"
      />
      {active && (
        <CommandList>
          {!current && <p className="py-6 text-center text-sm text-muted-foreground" aria-live="polite">Searching…</p>}
          {current?.error && (
            <p className="py-6 text-center text-sm text-destructive" role="alert">
              Customer search is unavailable right now — try again shortly.
            </p>
          )}
          {current && !current.error && (
            <>
              <CommandEmpty>No customer matches “{term}”.</CommandEmpty>
              {current.rows.length > 0 && (
                <CommandGroup
                  heading={current.total > current.rows.length
                    ? `Top ${current.rows.length} of ${current.total} matches — keep typing to narrow`
                    : `${current.total} match${current.total === 1 ? '' : 'es'}`}
                >
                  {current.rows.map((c) => (
                    <CommandItem
                      key={c.partyId}
                      value={String(c.partyId)}
                      className="min-h-11"
                      onSelect={() => router.push(`/dashboard/journey/${c.mobile}?name=${encodeURIComponent(c.name ?? '')}`)}
                    >
                      <UserRound aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{c.name ?? 'Unnamed customer'}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{c.mobile}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      )}
    </Command>
  );
}
