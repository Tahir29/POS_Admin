'use client';

// Store Sales — the breakdown behind the dashboard's "Total sales": every
// document type, per store, per payment mode, per salesperson, and every
// bill. Cancelled bills are shown separately and never counted in totals
// (see lib/sales.js). Follows the admin-wide date/store filter.

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DataTable from '@/components/DataTable';
import FilterBar from '@/components/FilterBar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFilters } from '@/hooks/use-filters';
import { customerDayHref, dash, dateTime, money } from '@/lib/format';
import { cn } from '@/lib/utils';

const rupees = (v) => (v ? money(Math.round(v)) : '—');
const TYPE_LABEL = { invoice: 'Invoice', order: 'Order', return: 'Return', exchange: 'Exchange', buyback: 'Buyback' };

function Kpi({ label, value, sub, tone }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="text-xs font-medium uppercase tracking-wide">{label}</CardDescription>
        <CardTitle>
          <span className={cn('text-xl font-semibold tabular-nums', tone)}>{value}</span>
        </CardTitle>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  );
}

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function Section({ title, description, children }) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mb-3 text-sm text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}

function SalesReport() {
  const router = useRouter();
  const { from, to, store } = useFilters();
  const key = `${from}|${to}|${store}`;
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sales?from=${from}&to=${to}${store ? `&store=${store}` : ''}`)
      .then((res) => {
        if (res.status === 401) { router.replace('/login'); return null; }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((d) => { if (!cancelled && d) setResult({ key, data: d }); })
      .catch(() => { if (!cancelled) setResult({ key, error: 'Could not load sales.' }); });
    return () => { cancelled = true; };
  }, [key, from, to, store, router]);

  const current = result?.key === key ? result : null;
  if (current?.error) return <Card><CardContent className="text-sm text-destructive">{current.error}</CardContent></Card>;
  if (!current) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  const { summary: s, byStore, byPayment, bySalesperson, documents } = current.data;
  const storeHref = (row) => `/dashboard/sales?from=${from}&to=${to}&store=${row.companyId}`;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-5">
        <Kpi label="Sales" value={rupees(s.invoice.amount)} sub={count(s.invoice.count, 'invoice')} />
        <Kpi label="Orders booked" value={rupees(s.order.amount)} sub={count(s.order.count, 'order')} />
        <Kpi label="Collected" value={rupees(s.collected)} sub="Paid on invoices & orders" />
        <Kpi label="Balance due" value={rupees(s.outstanding)} sub="Still owed by customers" />
        <Kpi label="Discounts given" value={rupees(s.discounts)} sub="Promotions & offers" />
        <Kpi label="Returns" value={rupees(s.return.amount)} sub={count(s.return.count, 'return')} />
        <Kpi label="Exchanges" value={rupees(s.exchange.amount)} sub={count(s.exchange.count, 'exchange')} />
        <Kpi label="Buybacks" value={rupees(s.buyback.amount)} sub={count(s.buyback.count, 'buyback')} />
        <Kpi
          label="Cancelled bills"
          value={s.cancelled.count}
          sub={s.cancelled.count ? `${rupees(s.cancelled.amount)} cancelled` : 'None'}
          tone={s.cancelled.count ? 'text-destructive' : undefined}
        />
      </div>

      {!store && (
        <Section title="By store" description="Tap a store to see only its sales.">
          <DataTable
            data={byStore}
            columns={[
              { title: 'Store', data: 'store', responsivePriority: 1, href: storeHref },
              { title: 'Sales', data: 'invoiceAmount', render: (v, t, r) => `${rupees(v)} (${r.invoiceCount})`, responsivePriority: 2 },
              { title: 'Orders', data: 'orderAmount', render: (v, t, r) => `${rupees(v)} (${r.orderCount})` },
              { title: 'Returns', data: 'returnAmount', render: (v, t, r) => (r.returnCount ? `${rupees(v)} (${r.returnCount})` : '—') },
              { title: 'Exchanges', data: 'exchangeAmount', render: (v, t, r) => (r.exchangeCount ? `${rupees(v)} (${r.exchangeCount})` : '—') },
              { title: 'Buybacks', data: 'buybackAmount', render: (v, t, r) => (r.buybackCount ? `${rupees(v)} (${r.buybackCount})` : '—') },
              { title: 'Discounts', data: 'discounts', render: rupees },
              { title: 'Cancelled', data: 'cancelled', render: (v) => (v ? count(v, 'bill') : '—') },
            ]}
          />
        </Section>
      )}

      <div className="grid gap-x-6 xl:grid-cols-2">
        <Section title="By payment mode" description="How customers paid on invoices and orders.">
          <DataTable
            data={byPayment}
            columns={[
              { title: 'Payment mode', data: 'mode', responsivePriority: 1 },
              { title: 'Amount', data: 'amount', render: rupees, responsivePriority: 2 },
              { title: 'Payments', data: 'count' },
            ]}
          />
        </Section>
        <Section title="By salesperson" description="As picked at checkout on the POS.">
          <DataTable
            data={bySalesperson}
            columns={[
              { title: 'Salesperson', data: 'salesperson', responsivePriority: 1 },
              { title: 'Amount', data: 'amount', render: rupees, responsivePriority: 2 },
              { title: 'Invoices', data: 'invoices' },
              { title: 'Orders', data: 'orders' },
            ]}
          />
        </Section>
      </div>

      <Section title="All bills" description="Every invoice, order, return, exchange and buyback — cancelled ones included and marked.">
        <DataTable
          data={documents}
          columns={[
            { title: 'Bill', data: 'documentNo', render: (v, t, r) => `${TYPE_LABEL[r.type] ?? r.type} ${v ?? ''}`.trim(), responsivePriority: 1 },
            { title: 'Time', data: 'at', render: dateTime, responsivePriority: 2 },
            { title: 'Status', data: 'status' },
            ...(store ? [] : [{ title: 'Store', data: 'store', render: dash }]),
            { title: 'Customer', data: 'customer', render: dash, href: (r) => customerDayHref(r.mobile, r.at) },
            { title: 'Items', data: 'items', render: dash },
            { title: 'Total', data: 'total', render: rupees },
            { title: 'Paid', data: 'paid', render: rupees },
            { title: 'Balance', data: 'balance', render: rupees },
            { title: 'Discount', data: 'discount', render: rupees },
            { title: 'Paid by', data: 'payments', render: dash },
          ]}
        />
      </Section>
    </>
  );
}

export default function StoreSalesPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Store Sales</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        What each store sold, how it was paid, and every bill. Cancelled bills are shown but never counted.
      </p>
      <Suspense>
        <FilterBar />
        <SalesReport />
      </Suspense>
    </div>
  );
}
