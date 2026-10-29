'use client';

// Vertical day-by-day timeline of POS events (lib/activity.js shape), shared
// by the Team Timeline and Customer Journey pages. Days newest first; inside
// a day oldest first, so it reads like what happened, in order.

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Ban, CircleCheck, ClipboardList, Coins, Eye, Footprints, Heart, HeartOff, LogIn, LogOut, PackageMinus, PackagePlus, PencilLine,
  Receipt, Repeat, ShieldAlert, ShoppingCart, TimerOff, Trash2, Undo2, UserPen, Wallet,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { customerDayHref, money } from '@/lib/format';
import { cn } from '@/lib/utils';

const KIND = {
  login: { icon: LogIn, tone: 'bg-status-in-stock/10 text-status-in-stock' },
  logout: { icon: LogOut, tone: 'bg-muted text-muted-foreground' },
  timeout: { icon: TimerOff, tone: 'bg-status-made-order/10 text-status-made-order' },
  failed: { icon: ShieldAlert, tone: 'bg-destructive/10 text-destructive' },
  walk_in: { icon: Footprints, tone: 'bg-primary/10 text-primary' },
  view: { icon: Eye, tone: 'bg-muted text-muted-foreground' },
  wishlist: { icon: Heart, tone: 'bg-accent/10 text-accent' },
  cart: { icon: ShoppingCart, tone: 'bg-destructive/10 text-destructive' },
  invoice: { icon: Receipt, tone: 'bg-status-in-stock/10 text-status-in-stock' },
  order: { icon: ClipboardList, tone: 'bg-status-in-stock/10 text-status-in-stock' },
  return: { icon: Undo2, tone: 'bg-status-made-order/10 text-status-made-order' },
  exchange: { icon: Repeat, tone: 'bg-status-made-order/10 text-status-made-order' },
  buyback: { icon: Coins, tone: 'bg-status-made-order/10 text-status-made-order' },
  // Change-log kinds (lib/collector.js) — red/amber for what an owner should check.
  cart_started: { icon: ShoppingCart, tone: 'bg-primary/10 text-primary' },
  cart_item_added: { icon: PackagePlus, tone: 'bg-primary/10 text-primary' },
  cart_item_removed: { icon: PackageMinus, tone: 'bg-status-made-order/10 text-status-made-order' },
  cart_qty_changed: { icon: ShoppingCart, tone: 'bg-muted text-muted-foreground' },
  cart_checked_out: { icon: CircleCheck, tone: 'bg-status-in-stock/10 text-status-in-stock' },
  cart_cleared: { icon: Trash2, tone: 'bg-destructive/10 text-destructive' },
  wishlist_removed: { icon: HeartOff, tone: 'bg-muted text-muted-foreground' },
  bill_cancelled: { icon: Ban, tone: 'bg-destructive/10 text-destructive' },
  bill_amount_changed: { icon: PencilLine, tone: 'bg-status-made-order/10 text-status-made-order' },
  bill_paid: { icon: Wallet, tone: 'bg-status-in-stock/10 text-status-in-stock' },
  bill_removed: { icon: Trash2, tone: 'bg-destructive/10 text-destructive' },
  customer_changed: { icon: UserPen, tone: 'bg-status-made-order/10 text-status-made-order' },
};

const IST = { timeZone: 'Asia/Kolkata' };
const dayLabel = (iso) => new Date(iso).toLocaleDateString('en-IN', { ...IST, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeLabel = (iso) => new Date(iso).toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', minute: '2-digit' });

/**
 * @param {{ events: object[], showStore?: boolean, showCustomer?: boolean }} props
 *   events newest first, as the API returns them.
 */
export default function Timeline({ events, showStore = true, showCustomer = true }) {
  const days = useMemo(() => {
    const groups = new Map();
    for (const e of events) {
      const key = dayLabel(e.at);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    return [...groups.entries()].map(([label, list]) => [label, [...list].reverse()]);
  }, [events]);

  return (
    <div className="flex flex-col gap-6">
      {days.map(([label, list]) => (
        <section key={label} aria-label={label}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            {label} <span className="font-normal">· {list.length} event{list.length === 1 ? '' : 's'}</span>
          </h2>
          <Card className="py-2">
            <ol className="relative">
              {list.map((e, i) => {
                const { icon: Icon, tone } = KIND[e.kind] ?? KIND.view;
                const meta = [
                  showStore && e.store && `${e.store}${e.storeInferred ? ' (store inferred)' : ''}`,
                  e.login && `login: ${e.login}`,
                ].filter(Boolean);
                return (
                  <li key={e.id} className="relative flex gap-3 px-4 py-2.5 sm:gap-4">
                    {/* connector line between icons */}
                    {i < list.length - 1 && (
                      <span className="absolute top-11 bottom-0 left-[1.95rem] w-px bg-border sm:left-[6.45rem]" aria-hidden />
                    )}
                    <time dateTime={e.at} className="hidden w-16 shrink-0 pt-1.5 text-right text-sm tabular-nums text-muted-foreground sm:block">
                      {timeLabel(e.at)}
                    </time>
                    <span className={cn('relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full', tone)}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-xs tabular-nums text-muted-foreground sm:hidden">{timeLabel(e.at)}</span>
                        <span className="font-medium">{e.event}</span>
                        {e.amount != null && <span className="text-sm font-semibold tabular-nums">{money(e.amount)}</span>}
                      </div>
                      {showCustomer && e.customer && (
                        <p className="text-sm">
                          {e.mobile ? (
                            <Link href={customerDayHref(e.mobile, e.at)} className="inline-flex min-h-8 items-center font-medium text-primary underline-offset-4 hover:underline">
                              {e.customer}
                            </Link>
                          ) : (
                            e.customer
                          )}
                        </p>
                      )}
                      {e.detail && <p className="text-sm wrap-break-word text-muted-foreground">{e.detail}</p>}
                      {meta.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{meta.join(' · ')}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </section>
      ))}
    </div>
  );
}
