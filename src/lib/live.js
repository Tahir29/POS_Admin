// src/lib/live.js
//
// This admin shows LIVE data only. lucira-pos writes both LIVE and UAT into
// the one shared database (UAT from local test machines), so every query on a
// collection that records its environment must apply one of these.
//
//   posSessions_POS     `environment` on every record
//   buyerPurchases_POS  `environment`; records WITHOUT it predate the field
//                       and are real LIVE sales — same rule as lucira-pos's
//                       own buyerPurchases.js environmentMatch()
//
// Carts, wishlist, recently viewed, customer profiles and the legacy walk-in
// log carry no environment at all, so they can't be split here — UAT and LIVE
// share customer ids (UAT was copied from LIVE), so not even those tell them
// apart. Only lucira-pos stamping `environment` on those writes can fix that.

export const LIVE_SESSIONS = { environment: 'LIVE' };

export const LIVE_PURCHASES = { $or: [{ environment: 'LIVE' }, { environment: { $exists: false } }] };
