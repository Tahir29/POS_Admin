// src/lib/stores.js
//
// The store list and company_id -> display name.
//
// Source of truth: LIVE OrnaVerse's own company list
// (Services/Administration/Company/List) — every store, including ones that
// haven't logged in yet, with its short display name (`mailing_name`, e.g.
// "Lucira Jewelry JM Road Pune") and code. Cached for an hour.
//
// If OrnaVerse can't be reached, names fall back to what lucira-pos itself
// has written: walkins_POS.companyName (legacy) and LIVE buyerPurchases_POS
// storeName — so pages still render, just possibly without never-used stores.

import { COLLECTIONS } from './mongo';
import { LIVE_PURCHASES } from './live';
import { ornaverseCall } from './ornaverse';

const CACHE_MS = 60 * 60 * 1000;
let cache = null; // { at, stores }
let inflight = null;

async function fromOrnaverse() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.stores;
  inflight ??= ornaverseCall('Services/Administration/Company/List', { Skip: 0, Take: 500 })
    .then((data) => {
      const stores = (data?.Entities ?? []).map((c) => ({
        companyId: c.company_id,
        name: c.mailing_name || c.company_name || `Store #${c.company_id}`,
        code: c.company_code ?? null,
        isHeadOffice: c.company_code === 'HO',
      }));
      cache = { at: Date.now(), stores };
      return stores;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

async function fromPosData(db) {
  const [walkIns, purchases] = await Promise.all([
    db.collection(COLLECTIONS.WALKINS)
      .aggregate([
        { $match: { companyName: { $nin: [null, ''] } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$company_id', name: { $first: '$companyName' }, code: { $first: '$companyCode' } } },
      ])
      .toArray(),
    db.collection(COLLECTIONS.BUYER_PURCHASES)
      .aggregate([
        { $match: { ...LIVE_PURCHASES, storeName: { $nin: [null, ''] } } },
        { $group: { _id: '$companyId', name: { $first: '$storeName' } } },
      ])
      .toArray(),
  ]);
  const byId = new Map(purchases.map((r) => [r._id, { name: r.name, code: null }]));
  for (const r of walkIns) byId.set(r._id, { name: r.name, code: r.code ?? null });
  return [...byId].map(([companyId, s]) => ({ companyId, ...s, isHeadOffice: s.code === 'HO' }));
}

/**
 * Every store, Head Office last, others A–Z.
 * @returns {Promise<{ companyId: number, name: string, code: string|null, isHeadOffice: boolean }[]>}
 */
export async function getStores(db) {
  const stores = await fromOrnaverse().catch((err) => {
    console.error('[stores] OrnaVerse company list unavailable, using POS data:', err?.message ?? err);
    return fromPosData(db);
  });
  return [...stores].sort((a, b) => Number(a.isHeadOffice) - Number(b.isHeadOffice) || a.name.localeCompare(b.name));
}

/** company_id -> display name. */
export async function getStoreNames(db) {
  return new Map((await getStores(db)).map((s) => [s.companyId, s.name]));
}

/** Display name, or "Store #4" when no name is known. */
export const storeName = (names, companyId) =>
  companyId == null ? null : names.get(companyId) ?? `Store #${companyId}`;

/** Head Office's company_id — where the all-store admin login is attributed. */
export const headOfficeId = (stores) => stores.find((s) => s.isHeadOffice)?.companyId ?? 1;
