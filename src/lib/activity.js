// src/lib/activity.js
//
// One timeline out of everything lucira-pos records in its own DB — the
// admin's "every moment" view, store-wise and per customer. Read-only, and
// nothing here needs lucira-pos to change: each source below is a collection
// the POS already writes for its own reasons, with its own timestamps.
//
//   posSessions_POS     store login / sign-out / idle timeout / failed login
//   OrnaVerse visits    customer walk-in, LIVE (best-effort call; skipped when
//                       OrnaVerse is unreachable). The legacy walkins_POS log
//                       is NOT used: it has no environment field (may hold UAT
//                       tests) and every real walk-in is in OrnaVerse anyway.
//   recentlyViewed_POS  each product viewed (items[].viewedAt)    } LIVE-checked per
//   wishlist_POS        each wishlist add (items[].addedAt)       } customer (lib/
//   abandonedCarts_POS  cart saved but not bought (deleted on sale) } liveCustomers.js)
//   buyerPurchases_POS  invoice / order / return / exchange / buyback
//   adminChangeLog      what the POS overwrites or deletes, captured by the
//                       admin's own collector (lib/collector.js): cart items
//                       added/removed, carts checked out or cleared, wishlist
//                       removals, views past the POS's 20-item cap, bills
//                       cancelled/edited/paid/deleted, customer detail edits.
//                       These carry `logged: true`.
//
// What the POS does NOT store, so this can't show: when a customer was
// attached/detached, pages visited, searches, individual cart add/remove,
// discounts, checkout steps. Those only go to WebEngage/GA from the POS.
//
// Customers are matched across sources by the last 10 digits of their mobile
// — the same rule as lucira-pos's own lib/mongo/normalizeMobile.js.
//
// Every event carries `companyIds` (the store(s) it happened at) so the
// admin-wide store filter applies everywhere. Product views and wishlist adds
// are saved WITHOUT a store, so they're attributed to the store(s) where the
// same customer walked in, had a cart or bought something that SAME day
// (`storeInferred: true`); with no such visit they only show under All stores.

import { COLLECTIONS } from './mongo';
import { ornaverseCall } from './ornaverse';
import { LIVE_SESSIONS, LIVE_PURCHASES } from './live';
import { getStores, storeName, headOfficeId } from './stores';
import { getLiveCustomers, isLiveRecord } from './liveCustomers';
import { STATUS_LABEL, resolveSession, sessionStoreLabel, sessionCompanyIds } from './posSessions';
import { duration, mobileKey } from './format';
import { istDay } from './dayRange';
import { getEmployeeNames, salespersonOf } from './employees';

export const MAX_EVENTS = 5000;
const ORNAVERSE_TIMEOUT_MS = 6000;

const DOC_LABEL = {
  invoice: 'Purchase (invoice)',
  order: 'Order placed',
  return: 'Return',
  exchange: 'Exchange',
  buyback: 'Buyback',
};

function itemNames(items, nameKey) {
  if (!Array.isArray(items) || !items.length) return '';
  const names = items.slice(0, 3).map((i) => i[nameKey]).filter(Boolean);
  const more = items.length > 3 ? ` +${items.length - 3} more` : '';
  return `${names.join(', ')}${more}`;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), ms)),
  ]);
}

async function ornaverseVisits() {
  // Newest first — OrnaVerse's default is oldest-first (see lucira-pos's
  // crmService.getCustomerVisits for when that hid recent visits).
  const data = await withTimeout(
    ornaverseCall('Services/CRM/CustomerVisits/List', { Skip: 0, Take: 5000, Sort: ['date DESC'] }),
    ORNAVERSE_TIMEOUT_MS
  );
  return data?.Entities ?? [];
}

/**
 * @param {import('mongodb').Db} db
 * @param {{ from?: Date|null, to?: Date|null, mobile?: string|null, store?: number|null, onlyLogged?: boolean }} params
 *   from/to bound the feed (to exclusive); `mobile` (10-digit key) instead
 *   returns one customer's whole history and skips store-session events;
 *   `store` (company_id) keeps only that store's events; `onlyLogged` keeps
 *   only change-log events.
 * @returns {Promise<{ events: object[], truncated: boolean, sources: { ornaverse: boolean, liveCheck: boolean } }>}
 */
export async function loadEvents(db, { from = null, to = null, mobile = null, store = null, onlyLogged = false }) {
  const inRange = (at) => {
    const t = at ? new Date(at).getTime() : NaN;
    if (Number.isNaN(t)) return false;
    return (!from || t >= from.getTime()) && (!to || t < to.getTime());
  };
  const range = { ...(from && { $gte: from }), ...(to && { $lt: to }) };
  const hasRange = Object.keys(range).length > 0;
  const tail = mobile ? { $regex: `${mobile}$` } : null;

  // A session that started just before `from` can still end inside it.
  const sessionFloor = from ? new Date(from.getTime() - 24 * 60 * 60 * 1000) : null;

  const [stores, employees, live, sessions, visits, viewed, wishlists, carts, purchases, changes] = await Promise.all([
    getStores(db),
    getEmployeeNames(),
    // No environment on carts/wishlist/views: without the LIVE check they're
    // left out entirely rather than shown unverified.
    getLiveCustomers().catch((err) => {
      console.error('[activity] LIVE customer check unavailable:', err?.message ?? err);
      return null;
    }),
    mobile
      ? []
      : db.collection(COLLECTIONS.POS_SESSIONS)
          .find({ ...LIVE_SESSIONS, ...(sessionFloor && { loginAt: { $gte: sessionFloor, ...(to && { $lt: to }) } }) })
          .toArray(),
    ornaverseVisits().catch((err) => {
      console.error('[activity] OrnaVerse visits skipped:', err?.message ?? err);
      return null;
    }),
    // updatedAt is the latest view/add on the doc, so it's a safe prefilter
    // for "has an item inside the range"; items are checked one by one below.
    db.collection(COLLECTIONS.RECENTLY_VIEWED)
      .find(mobile ? { mobileKey: mobile } : from ? { updatedAt: { $gte: from } } : {})
      .toArray(),
    db.collection(COLLECTIONS.WISHLIST)
      .find(mobile ? { mobileKey: mobile } : from ? { updatedAt: { $gte: from } } : {})
      .toArray(),
    db.collection(COLLECTIONS.ABANDONED_CARTS)
      .find(mobile ? { mobileKey: mobile } : hasRange ? { updatedAt: range } : {})
      .toArray(),
    db.collection(COLLECTIONS.BUYER_PURCHASES)
      .find({ ...LIVE_PURCHASES, ...(mobile ? { customerMobile: tail } : hasRange ? { documentDate: range } : {}) })
      .toArray(),
    db.collection(COLLECTIONS.CHANGE_LOG)
      .find(mobile ? { mobile } : hasRange ? { at: range } : {})
      .toArray(),
  ]);

  const names = new Map(stores.map((st) => [st.companyId, st.name]));
  const hoId = headOfficeId(stores);
  const isLive = (doc) => live !== null && isLiveRecord(live, doc.party_id, doc.customerMobile);
  const events = [];
  const push = (e) => { if (inRange(e.at)) events.push(e); };
  const now = Date.now();
  const storeOf = (id) => storeName(names, id);

  // Failed logins carry only the typed username — attribute them to the
  // store(s) that username signs in to successfully.
  const companiesByUser = new Map();
  for (const sess of sessions) {
    if (sess.status !== 'failed' && sess.username) {
      companiesByUser.set(sess.username.trim().toLowerCase(), { ids: sessionCompanyIds(sess, hoId), label: sessionStoreLabel(sess, names, hoId) });
    }
  }

  for (const sess of sessions) {
    const id = String(sess._id);
    if (sess.status === 'failed') {
      const known = companiesByUser.get(String(sess.username ?? '').trim().toLowerCase());
      push({
        id: `${id}-fail`, at: sess.loginAt, kind: 'failed', type: 'session', event: STATUS_LABEL.failed,
        companyIds: known?.ids ?? [], store: known?.label ?? null, login: sess.username, detail: sess.failureCode ?? null,
      });
      continue;
    }
    const base = { type: 'session', companyIds: sessionCompanyIds(sess, hoId), store: sessionStoreLabel(sess, names, hoId), login: sess.username };
    push({ ...base, id: `${id}-in`, at: sess.loginAt, kind: 'login', event: 'Logged in to POS', detail: sess.ip ? `IP ${sess.ip}` : null });
    const { state, endedAt } = resolveSession(sess, now);
    if (state !== 'active') {
      push({
        ...base, id: `${id}-out`, at: endedAt, kind: state === 'idle_timeout' ? 'timeout' : 'logout', event: STATUS_LABEL[state],
        detail: `Was logged in for ${duration(endedAt.getTime() - new Date(sess.loginAt).getTime())}`,
      });
    }
  }

  for (const v of visits ?? []) {
    const key = mobileKey(v.mobile);
    if (mobile && key !== mobile) continue;
    push({
      id: `ov-${v.id}`, at: v.date, kind: 'walk_in', type: 'walk_in', event: 'Customer walk-in',
      companyIds: v.company_id != null ? [v.company_id] : [], store: names.get(v.company_id) ?? v.mailing_name ?? v.company_name ?? null,
      login: null, customer: v.customer_name?.trim() || null, mobile: key,
      detail: [v.source, v.notes].filter(Boolean).join(' · ') || null,
    });
  }

  for (const c of carts.filter(isLive)) {
    const count = Array.isArray(c.items) ? c.items.length : 0;
    push({
      id: `cart-${c._id}`, at: c.updatedAt, kind: 'cart', type: 'cart', event: 'Cart left — not purchased',
      companyIds: c.company_id != null ? [c.company_id] : [], store: storeOf(c.company_id), login: null,
      customer: c.customerName ?? null, mobile: c.mobileKey ?? null,
      detail: `${count} item${count === 1 ? '' : 's'}: ${itemNames(c.items, 'itemName')}`, amount: c.total ?? null,
    });
  }

  for (const p of purchases) {
    push({
      id: `doc-${p._id}`, at: p.documentDate, kind: p.documentType ?? 'invoice', type: 'sale', event: DOC_LABEL[p.documentType] ?? p.documentType,
      companyIds: p.companyId != null ? [p.companyId] : [], store: names.get(p.companyId) ?? p.storeName ?? storeOf(p.companyId), login: null,
      customer: p.customerName ?? null, mobile: mobileKey(p.customerMobile),
      detail: [p.documentNo, itemNames(p.items, 'item_name'), salespersonOf(p, employees) && `Salesperson: ${salespersonOf(p, employees)}`]
        .filter(Boolean).join(' · '),
      amount: p.totalAmount ?? null,
    });
  }

  // Change-log events — LIVE only: bills by their own environment field,
  // everything else by the LIVE customer check (lib/liveCustomers.js).
  const liveChange = (c) => (c.source === 'bill'
    ? c.environment == null || c.environment === 'LIVE'
    : live !== null && isLiveRecord(live, c.partyId, c.customerMobile));
  const toEvent = (c) => ({
    id: `log-${c._id}`, at: c.at, kind: c.kind, type: 'change', event: c.event, logged: true,
    companyIds: c.companyIds ?? [], store: (c.companyIds ?? []).map(storeOf).join(' + ') || null, login: null,
    customer: c.customer ?? null, mobile: c.mobile ?? null, detail: c.detail ?? null, amount: c.amount ?? null,
  });
  const loggedChanges = changes.filter(liveChange);
  for (const c of loggedChanges.filter((x) => x.companyIds?.length)) push(toEvent(c));

  // Where each customer was seen, per IST day — used to place store-less events.
  const seenAt = new Map();
  for (const e of events) {
    if (!e.mobile || !e.companyIds.length) continue;
    const k = `${e.mobile}|${istDay(e.at)}`;
    seenAt.set(k, new Set([...(seenAt.get(k) ?? []), ...e.companyIds]));
  }
  const placed = (key, at) => {
    const ids = [...(seenAt.get(`${key}|${istDay(at)}`) ?? [])];
    return { companyIds: ids, store: ids.map(storeOf).join(' + ') || null, storeInferred: ids.length > 0 };
  };

  for (const doc of viewed.filter(isLive)) {
    for (const item of doc.items ?? []) {
      push({
        id: `rv-${doc._id}-${item.item_id}-${item.viewedAt}`, at: item.viewedAt, kind: 'view', type: 'product', event: 'Viewed product',
        ...placed(doc.mobileKey, item.viewedAt), login: null, customer: doc.customerName ?? null, mobile: doc.mobileKey ?? null,
        detail: [item.item_name, item.item_code].filter(Boolean).join(' · '),
      });
    }
  }

  for (const doc of wishlists.filter(isLive)) {
    for (const item of doc.items ?? []) {
      push({
        id: `wl-${doc._id}-${item.item_id}-${item.addedAt}`, at: item.addedAt, kind: 'wishlist', type: 'product', event: 'Added to wishlist',
        ...placed(doc.mobileKey, item.addedAt), login: null, customer: doc.customerName ?? null, mobile: doc.mobileKey ?? null,
        detail: [item.item_name, item.item_size_name && `size ${item.item_size_name}`].filter(Boolean).join(' · '),
      });
    }
  }

  for (const c of loggedChanges.filter((x) => !x.companyIds?.length)) {
    push({ ...toEvent(c), ...(c.mobile ? placed(c.mobile, c.at) : {}) });
  }

  if (onlyLogged) {
    const kept = events.filter((e) => e.logged);
    events.length = 0;
    events.push(...kept);
  }

  if (store != null) {
    const kept = events.filter((e) => e.companyIds.includes(store));
    events.length = 0;
    events.push(...kept);
  }

  events.sort((a, b) => new Date(b.at) - new Date(a.at));
  return {
    events: events.slice(0, MAX_EVENTS),
    truncated: events.length > MAX_EVENTS,
    sources: { ornaverse: visits !== null, liveCheck: live !== null },
  };
}
