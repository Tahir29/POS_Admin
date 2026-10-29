// src/lib/liveCustomers.js
//
// Proves a POS record is LIVE when the record itself can't say so.
//
// Carts, wishlist, recently viewed and customer profiles carry no
// `environment` field (see lib/live.js), and UAT was copied from LIVE, so the
// two share customer ids. What still differs: a customer created in UAT after
// the copy gets an id that, in LIVE, belongs to someone else (or no one). So a
// record counts as LIVE only when LIVE OrnaVerse has that exact party_id WITH
// the same mobile number. Confirmed on real data 2026-10-29: this drops the
// known UAT test customers ("Tahir Test", "Vishal Mehta Test", ...).
//
// Limit: a UAT test done on a customer who also exists in LIVE (same id and
// mobile) still passes — nothing in the record can tell those apart.

import { ornaverseCall } from './ornaverse';

const CACHE_MS = 10 * 60 * 1000;
let cache = null; // { at, map: Map<party_id, mobileDigits>, list: { partyId, name, mobile }[] }
let inflight = null;

const digits = (v) => String(v ?? '').replace(/\D/g, '');

// One OrnaVerse call feeds both the LIVE check and customer search.
async function load() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  // shortcut: one page of up to 20,000 (LIVE had 5,060 on 2026-10-29) — page through it if LIVE ever nears that.
  inflight ??= ornaverseCall('Services/POS/Customer/List', { Skip: 0, Take: 20000 })
    .then((data) => {
      const rows = data?.Entities ?? [];
      cache = {
        at: Date.now(),
        map: new Map(rows.map((c) => [c.party_id, digits(c.mobile)])),
        list: rows.map((c) => ({ partyId: c.party_id, name: c.party_name?.trim() || null, mobile: digits(c.mobile).slice(-10) || null })),
      };
      return cache;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

/** LIVE customers as party_id -> mobile digits; cached for 10 minutes. Throws if OrnaVerse fails. */
export async function getLiveCustomers() {
  return (await load()).map;
}

/** LIVE customers for search: { partyId, name, mobile (last 10 digits) }[]. Throws if OrnaVerse fails. */
export async function getLiveCustomerList() {
  return (await load()).list;
}

/**
 * @param {Map<number, string>} live — from getLiveCustomers()
 * @param {number} partyId
 * @param {string|null} mobile — full ("+919822515432") or POS-masked ("******5445")
 */
export function isLiveRecord(live, partyId, mobile) {
  const liveMobile = live.get(partyId);
  if (!liveMobile) return false;
  const own = digits(mobile);
  if (own.length >= 10) return liveMobile.slice(-10) === own.slice(-10);
  // The POS masks some numbers ("******5445") — compare the visible tail.
  return String(mobile ?? '').includes('*') && own.length >= 4 && liveMobile.endsWith(own);
}

export const LIVE_CHECK_FAILED = 'Could not check these records against LIVE OrnaVerse right now — try again shortly.';
