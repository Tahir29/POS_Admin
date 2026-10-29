import { requireAdminSession } from '@/lib/requireAdminSession';
import { getDb, COLLECTIONS } from '@/lib/mongo';
import { LIVE_PURCHASES } from '@/lib/live';
import { getStores, storeName } from '@/lib/stores';
import { parseDayRange, parseStore } from '@/lib/dayRange';
import { DOC_TYPES, discountOf, isCancelled, isDraft } from '@/lib/sales';
import { mobileKey } from '@/lib/format';
import { getEmployeeNames, salespersonOf } from '@/lib/employees';

// Store Sales for a date range (default today), all stores or one: totals per
// document type, per store, per payment mode and per salesperson, plus every
// bill. Cancelled bills are counted separately, never in the totals — see
// lib/sales.js.
export async function GET(request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const params = new URL(request.url).searchParams;
  const range = parseDayRange(params);
  if (range.error) return Response.json({ error: range.error }, { status: 400 });
  const store = parseStore(params);

  const db = await getDb();
  const [stores, employees, docs] = await Promise.all([
    getStores(db),
    getEmployeeNames(),
    db.collection(COLLECTIONS.BUYER_PURCHASES)
      .find({
        ...LIVE_PURCHASES,
        documentDate: { $gte: range.from, $lt: range.to },
        ...(store != null && { companyId: store }),
      })
      .sort({ documentDate: -1 })
      .toArray(),
  ]);
  const names = new Map(stores.map((s) => [s.companyId, s.name]));

  const emptyTotals = () => Object.fromEntries(DOC_TYPES.map((t) => [t, { count: 0, amount: 0 }]));
  const totals = emptyTotals();
  const cancelled = { count: 0, amount: 0 };
  let discounts = 0;
  let collected = 0;
  let outstanding = 0;
  const byStore = new Map();
  const byPayment = new Map();
  const bySalesperson = new Map();

  for (const d of docs) {
    if (isDraft(d)) continue;
    const amount = Number(d.totalAmount) || 0;
    const storeRow = byStore.get(d.companyId) ?? { companyId: d.companyId, totals: emptyTotals(), cancelled: 0, discounts: 0 };
    byStore.set(d.companyId, storeRow);

    if (isCancelled(d)) {
      cancelled.count += 1;
      cancelled.amount += amount;
      storeRow.cancelled += 1;
      continue;
    }
    const type = DOC_TYPES.includes(d.documentType) ? d.documentType : null;
    if (type) {
      totals[type].count += 1;
      totals[type].amount += amount;
      storeRow.totals[type].count += 1;
      storeRow.totals[type].amount += amount;
    }

    // Money taken in and owed only means something on sales documents.
    if (d.documentType === 'invoice' || d.documentType === 'order') {
      const disc = discountOf(d);
      discounts += disc;
      storeRow.discounts += disc;
      collected += Number(d.receiptAmount) || 0;
      outstanding += Number(d.balanceAmount) || 0;
      for (const pay of d.payments ?? []) {
        const mode = pay.modeName || 'Other';
        const row = byPayment.get(mode) ?? { mode, count: 0, amount: 0 };
        row.count += 1;
        row.amount += Number(pay.amount) || 0;
        byPayment.set(mode, row);
      }
      const person = salespersonOf(d, employees) ?? 'Not recorded';
      const sp = bySalesperson.get(person) ?? { salesperson: person, invoices: 0, orders: 0, amount: 0 };
      if (d.documentType === 'invoice') sp.invoices += 1;
      else sp.orders += 1;
      sp.amount += amount;
      bySalesperson.set(person, sp);
    }
  }

  const flat = (r) => ({
    id: String(r.companyId),
    companyId: r.companyId,
    store: storeName(names, r.companyId),
    ...Object.fromEntries(DOC_TYPES.flatMap((t) => [[`${t}Count`, r.totals[t].count], [`${t}Amount`, r.totals[t].amount]])),
    cancelled: r.cancelled,
    discounts: r.discounts,
  });

  return Response.json({
    summary: { ...totals, cancelled, discounts, collected, outstanding },
    byStore: [...byStore.values()].map(flat).sort((a, b) => b.invoiceAmount - a.invoiceAmount),
    byPayment: [...byPayment.values()].map((r) => ({ id: r.mode, ...r })).sort((a, b) => b.amount - a.amount),
    bySalesperson: [...bySalesperson.values()].map((r) => ({ id: r.salesperson, ...r })).sort((a, b) => b.amount - a.amount),
    documents: docs.filter((d) => !isDraft(d)).map((d) => ({
      id: String(d._id),
      at: d.documentDate,
      store: storeName(names, d.companyId) ?? d.storeName,
      type: d.documentType,
      documentNo: d.documentNo ?? null,
      status: isCancelled(d) ? 'Cancelled' : 'Posted',
      customer: d.customerName ?? null,
      mobile: mobileKey(d.customerMobile),
      items: (d.items ?? []).map((i) => i.item_name).filter(Boolean).join(', ') || null,
      salesperson: salespersonOf(d, employees),
      total: Number(d.totalAmount) || 0,
      paid: Number(d.receiptAmount) || 0,
      balance: Number(d.balanceAmount) || 0,
      discount: discountOf(d),
      payments: (d.payments ?? []).map((p) => p.modeName).filter(Boolean).join(', ') || null,
    })),
  });
}
