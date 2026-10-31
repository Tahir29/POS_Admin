// src/lib/collector.js
//
// The admin's own permanent change log.
//
// lucira-pos keeps only the CURRENT state of most records — a cart vanishes
// on checkout, removed cart/wishlist items leave no trace, recently-viewed
// keeps just the latest 20 per customer, a cancelled bill simply has its
// status overwritten, an edited customer profile replaces the old values.
// Without touching the POS, the admin keeps its own snapshot of each record
// and, every run, writes what CHANGED to an append-only log:
//
//   adminSnapshots   last seen state per record   { _id: "<source>:<id>", source, state }
//   adminChangeLog   one entry per detected change (never updated or deleted)
//   adminMeta        collector bookkeeping (lock, last run)
//
// These are admin-owned collections in the same database; the POS's own
// collections are only ever READ here.
//
// Timing: carts, wishlists, bills and customers carry their own updatedAt /
// syncedAt, so most changes get their real time. A cart that disappears gets
// the time of the sale it turned into, or the time the collector noticed.
// Granularity: if a record changes twice between runs, only the net change
// is seen — runs happen every minute while the admin is open (see
// maybeCollect) and on demand via /api/collect.

import { COLLECTIONS } from './mongo';
import { mobileKey } from './format';
import { billTime } from './sales';

const OVERLAP_MS = 2 * 60 * 1000; // re-read a little before the last run, so nothing slips between runs
const MIN_INTERVAL_MS = 60 * 1000;
const LOCK_MS = 2 * 60 * 1000;

const META_ID = 'collector';

// Customer fields whose edits are worth an owner's attention.
const CUSTOMER_FIELDS = {
  party_name: 'Name', mobile: 'Mobile', phone: 'Phone', email: 'Email', address: 'Address',
  pin_code: 'PIN', city_name: 'City', state_name: 'State', birth_date: 'Birthday',
  anniversary_date: 'Anniversary', gender: 'Gender', is_disabled: 'Disabled',
};

const fmtAmount = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ── per-source state + diff ────────────────────────────────────────────────

const cartItemKey = (i) => `${i.itemId}|${i.sizeId ?? ''}`;
const wishItemKey = (i) => `${i.item_id}|${i.item_size_id ?? ''}`;
// Snapshot item maps are stored as Mongo field names — no dots allowed in
// keys, so the view time goes in as epoch ms, not its ISO string.
const viewItemKey = (i) => `${i.item_id}|${new Date(i.viewedAt).getTime()}`;

const customerRef = (doc) => ({
  partyId: doc.party_id ?? null,
  customerMobile: doc.customerMobile ?? doc.profile?.mobile ?? null,
  mobile: doc.mobileKey ?? mobileKey(doc.customerMobile ?? doc.profile?.mobile),
  customer: doc.customerName ?? doc.profile?.party_name ?? null,
});

const SOURCES = [
  {
    name: 'cart',
    collection: COLLECTIONS.ABANDONED_CARTS,
    timeField: 'updatedAt',
    state: (d) => ({
      ...customerRef(d),
      companyId: d.company_id ?? null,
      total: d.total ?? null,
      updatedAt: d.updatedAt ?? null,
      items: Object.fromEntries((d.items ?? []).map((i) => [cartItemKey(i), { name: i.itemName ?? i.itemCode ?? 'Item', qty: i.quantity ?? 1, price: i.unitPrice ?? null }])),
    }),
    diff(before, after, { at }) {
      const base = { ...pick(after), companyIds: after.companyId != null ? [after.companyId] : [] };
      if (!before) {
        const names = Object.values(after.items).map((i) => i.name);
        return [{ ...base, kind: 'cart_started', event: 'Cart started', at, amount: after.total, detail: `${plural(names.length, 'item')}: ${names.join(', ')}` }];
      }
      const out = [];
      for (const [k, i] of Object.entries(after.items)) {
        const prev = before.items[k];
        if (!prev) out.push({ ...base, kind: 'cart_item_added', event: 'Added to cart', at, amount: i.price, detail: `${i.name}${i.qty > 1 ? ` × ${i.qty}` : ''}` });
        else if (prev.qty !== i.qty) out.push({ ...base, kind: 'cart_qty_changed', event: 'Cart quantity changed', at, detail: `${i.name}: ${prev.qty} → ${i.qty}` });
      }
      for (const [k, i] of Object.entries(before.items)) {
        if (!after.items[k]) out.push({ ...base, kind: 'cart_item_removed', event: 'Removed from cart', at, amount: i.price, detail: i.name });
      }
      return out;
    },
    async removed(before, { db, now }) {
      // A cart disappears on checkout OR when it's cleared. A sale for the
      // same customer around the cart's last update tells which — the one
      // nearest that update, so two carts in a row each get their own bill.
      const cartAt = new Date(before.updatedAt ?? now).getTime();
      const since = new Date(cartAt - 60 * 60 * 1000);
      const candidates = before.mobile
        ? await db.collection(COLLECTIONS.BUYER_PURCHASES)
            .find({ customerMobile: { $regex: `${before.mobile}$` }, documentDate: { $gte: since }, documentType: { $in: ['invoice', 'order'] } })
            .toArray()
        : [];
      const sale = candidates
        .filter((s) => billTime(s).getTime() >= since.getTime())
        .sort((a, b) => Math.abs(billTime(a) - cartAt) - Math.abs(billTime(b) - cartAt))[0];
      const names = Object.values(before.items).map((i) => i.name);
      const base = { ...pick(before), companyIds: before.companyId != null ? [before.companyId] : [] };
      return sale
        ? [{ ...base, kind: 'cart_checked_out', event: 'Cart checked out', at: billTime(sale), amount: sale.totalAmount, detail: `Became ${sale.documentType} ${sale.documentNo ?? ''}`.trim() }]
        : [{ ...base, kind: 'cart_cleared', event: 'Cart cleared — no sale', at: now, amount: before.total, detail: `${plural(names.length, 'item')}: ${names.join(', ')}` }];
    },
  },
  {
    name: 'wishlist',
    collection: COLLECTIONS.WISHLIST,
    timeField: 'updatedAt',
    state: (d) => ({ ...customerRef(d), items: Object.fromEntries((d.items ?? []).map((i) => [wishItemKey(i), { name: i.item_name ?? i.item_code ?? 'Item' }])) }),
    // Adds already show from the wishlist itself (items[].addedAt) — only
    // removals would otherwise be lost.
    diff(before, after, { at }) {
      if (!before) return [];
      return Object.entries(before.items)
        .filter(([k]) => !after.items[k])
        .map(([, i]) => ({ ...pick(after), companyIds: [], kind: 'wishlist_removed', event: 'Removed from wishlist', at, detail: i.name }));
    },
    async removed(before, { now }) {
      return Object.values(before.items).map((i) => ({ ...pick(before), companyIds: [], kind: 'wishlist_removed', event: 'Removed from wishlist', at: now, detail: i.name }));
    },
  },
  {
    name: 'view',
    collection: COLLECTIONS.RECENTLY_VIEWED,
    timeField: 'updatedAt',
    state: (d) => ({
      ...customerRef(d),
      items: Object.fromEntries((d.items ?? []).map((i) => [viewItemKey(i), { name: i.item_name ?? 'Item', code: i.item_code ?? null, viewedAt: i.viewedAt }])),
    }),
    // The POS keeps only the latest 20 views per customer; a view dropping
    // off the end is archived here with its ORIGINAL time, so it stays in
    // the customer's history.
    diff(before, after) {
      if (!before) return [];
      return Object.entries(before.items)
        .filter(([k]) => !after.items[k])
        .map(([, i]) => ({ ...pick(after), companyIds: [], kind: 'view', event: 'Viewed product', at: i.viewedAt, detail: [i.name, i.code].filter(Boolean).join(' · '), archived: true }));
    },
    async removed() { return []; },
  },
  {
    name: 'bill',
    collection: COLLECTIONS.BUYER_PURCHASES,
    timeField: 'updatedAt',
    state: (d) => ({
      ...customerRef(d),
      customer: d.customerName ?? null,
      companyId: d.companyId ?? null,
      environment: d.environment ?? null,
      type: d.documentType ?? null,
      docNo: d.documentNo ?? null,
      status: d.documentStatus ?? null,
      total: d.totalAmount ?? null,
      paid: d.receiptAmount ?? null,
      balance: d.balanceAmount ?? null,
    }),
    // New bills already show from the bill itself; what's lost is what
    // happens to a bill AFTER it's raised.
    diff(before, after, { at }) {
      if (!before) return [];
      const base = { ...pick(after), companyIds: after.companyId != null ? [after.companyId] : [], environment: after.environment };
      const label = `${after.type ?? 'bill'} ${after.docNo ?? ''}`.trim();
      const out = [];
      if (before.status !== 2 && after.status === 2) {
        out.push({ ...base, kind: 'bill_cancelled', event: 'Bill cancelled', at, amount: after.total, detail: label });
      }
      if (Number(before.total) !== Number(after.total)) {
        out.push({ ...base, kind: 'bill_amount_changed', event: 'Bill amount changed', at, amount: after.total, detail: `${label}: ${fmtAmount(before.total)} → ${fmtAmount(after.total)}` });
      }
      if (Number(after.paid) > Number(before.paid)) {
        out.push({ ...base, kind: 'bill_paid', event: 'Payment received', at, amount: Number(after.paid) - Number(before.paid), detail: `${label} · balance ${fmtAmount(before.balance)} → ${fmtAmount(after.balance)}` });
      }
      return out;
    },
    async removed(before, { now }) {
      return [{
        ...pick(before), companyIds: before.companyId != null ? [before.companyId] : [], environment: before.environment,
        kind: 'bill_removed', event: 'Bill deleted', at: now, amount: before.total, detail: `${before.type ?? 'bill'} ${before.docNo ?? ''}`.trim(),
      }];
    },
  },
  {
    name: 'customer',
    collection: COLLECTIONS.CUSTOMERS,
    timeField: 'syncedAt',
    state: (d) => ({
      ...customerRef(d),
      fields: Object.fromEntries(Object.keys(CUSTOMER_FIELDS).filter((k) => d.profile?.[k] !== undefined).map((k) => [k, d.profile[k] ?? null])),
    }),
    diff(before, after, { at }) {
      if (!before) return [];
      const changes = Object.entries(CUSTOMER_FIELDS)
        .filter(([k]) => k in before.fields && k in after.fields && String(before.fields[k] ?? '') !== String(after.fields[k] ?? ''))
        .map(([k, label]) => `${label}: ${before.fields[k] || '—'} → ${after.fields[k] || '—'}`);
      if (!changes.length) return [];
      return [{ ...pick(after), companyIds: [], kind: 'customer_changed', event: 'Customer details changed', at, detail: changes.join('; ') }];
    },
    async removed() { return []; },
  },
];

function pick(state) {
  return { partyId: state.partyId, customerMobile: state.customerMobile, mobile: state.mobile, customer: state.customer };
}

// ── run ────────────────────────────────────────────────────────────────────

async function ensureIndexes(db) {
  await Promise.all([
    db.collection(COLLECTIONS.CHANGE_LOG).createIndex({ at: -1 }),
    db.collection(COLLECTIONS.CHANGE_LOG).createIndex({ mobile: 1, at: -1 }),
    db.collection(COLLECTIONS.SNAPSHOTS).createIndex({ source: 1 }),
  ]);
}

async function runSource(db, src, { since, now, baseline }) {
  const snapCol = db.collection(COLLECTIONS.SNAPSHOTS);
  const [current, ids, snaps] = await Promise.all([
    db.collection(src.collection).find(since && !baseline ? { [src.timeField]: { $gte: since } } : {}).toArray(),
    db.collection(src.collection).find({}, { projection: { _id: 1 } }).toArray(),
    snapCol.find({ source: src.name }).toArray(),
  ]);
  const snapById = new Map(snaps.map((s) => [s._id, s.state]));
  const liveIds = new Set(ids.map((d) => `${src.name}:${d._id}`));

  const events = [];
  const writes = [];
  for (const doc of current) {
    const id = `${src.name}:${doc._id}`;
    const after = src.state(doc);
    const before = snapById.get(id);
    if (!baseline && JSON.stringify(before) !== JSON.stringify(after)) {
      events.push(...src.diff(before, after, { at: doc[src.timeField] ?? now, now, db }).map((e) => ({ ...e, source: src.name, docId: String(doc._id) })));
    }
    writes.push({ replaceOne: { filter: { _id: id }, replacement: { _id: id, source: src.name, state: after }, upsert: true } });
  }
  for (const [id, before] of snapById) {
    if (liveIds.has(id)) continue;
    if (!baseline) events.push(...(await src.removed(before, { db, now })).map((e) => ({ ...e, source: src.name, docId: id.slice(src.name.length + 1) })));
    writes.push({ deleteOne: { filter: { _id: id } } });
  }

  if (writes.length) await snapCol.bulkWrite(writes, { ordered: false });
  return events;
}

/**
 * One collector pass. Returns null if another pass is running or one ran
 * within the last minute (unless `force`).
 * @returns {Promise<null | { baseline: boolean, logged: number }>}
 */
export async function collect(db, { force = false } = {}) {
  const meta = db.collection(COLLECTIONS.ADMIN_META);
  const now = new Date();

  // Atomic lock: only one pass at a time, across every admin tab/instance.
  let lock;
  try {
    lock = await meta.findOneAndUpdate(
      {
        _id: META_ID,
        $and: [
          { $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lt: now } }] },
          ...(force ? [] : [{ $or: [{ lastRunAt: { $exists: false } }, { lastRunAt: { $lt: new Date(now - MIN_INTERVAL_MS) } }] }]),
        ],
      },
      { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS) } },
      { upsert: true, returnDocument: 'before' },
    );
  } catch (err) {
    if (err?.code === 11000) return null; // locked, or ran too recently
    throw err;
  }

  try {
    const baseline = !lock?.lastRunAt;
    if (baseline) await ensureIndexes(db);
    const since = lock?.lastRunAt ? new Date(lock.lastRunAt.getTime() - OVERLAP_MS) : null;

    const events = [];
    for (const src of SOURCES) events.push(...(await runSource(db, src, { since, now, baseline })));
    if (events.length) {
      await db.collection(COLLECTIONS.CHANGE_LOG).insertMany(events.map((e) => ({ ...e, at: new Date(e.at ?? now), detectedAt: now })));
    }

    await meta.updateOne({ _id: META_ID }, { $set: { lastRunAt: now, lastLogged: events.length }, $unset: { lockedUntil: '' } });
    return { baseline, logged: events.length };
  } catch (err) {
    await meta.updateOne({ _id: META_ID }, { $unset: { lockedUntil: '' } }).catch(() => {});
    throw err;
  }
}

/** Fire-and-forget pass, throttled to once a minute — called on admin page loads. */
export function maybeCollect(db) {
  return collect(db).catch((err) => console.error('[collector]', err?.message ?? err));
}
