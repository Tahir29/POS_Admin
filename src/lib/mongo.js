// src/lib/mongo.js
//
// This app's OWN MongoDB connection — deliberately not imported from
// lucira-pos, even though it points at the exact same Atlas
// cluster/database. Sharing the connection STRING (same data) is fine and
// expected for an admin viewer; sharing the connection CODE would create a
// dependency between the two repos, which is exactly what this project is
// supposed to avoid (see README.md).
//
// Caches the connection on `globalThis` across Next.js dev-mode hot-reloads
// and repeated route-handler invocations — same reasoning as lucira-pos's
// own src/lib/mongo/client.js.
//
// DB NAME: not a separate env var. MONGODB_URI's own path names the
// database (".../lucira_pos?..."), and MongoClient.db() with no argument
// uses exactly that.

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('[lucira-pos-admin] MONGODB_URI is not set. Add it to .env.local.');
}

let cachedClientPromise = globalThis._posAdminMongoClientPromise;

if (!cachedClientPromise) {
  const client = new MongoClient(uri);
  cachedClientPromise = client.connect();
  globalThis._posAdminMongoClientPromise = cachedClientPromise;
}

export async function getDb() {
  const client = await cachedClientPromise;
  return client.db();
}

// Collection names as lucira-pos itself defines them (see that repo's
// src/lib/mongo/*.js — each file's own `COLLECTION` constant). Named here,
// not imported, for the same "no cross-repo code dependency" reason above;
// if lucira-pos ever renames one of these, this file needs updating by
// hand to match — that's the accepted cost of staying decoupled.
export const COLLECTIONS = {
  ABANDONED_CARTS: 'abandonedCarts_POS',
  BUYER_PURCHASES: 'buyerPurchases_POS',
  POS_SESSIONS:    'posSessions_POS',
  WALKINS:         'walkins_POS',
  CUSTOMERS:       'customers_POS',
  RECENTLY_VIEWED: 'recentlyViewed_POS',
  WISHLIST:        'wishlist_POS',

  // Admin-OWNED collections (written by lib/collector.js; lucira-pos never
  // touches them, and the admin never writes to the POS's own ones above).
  CHANGE_LOG:      'adminChangeLog',
  SNAPSHOTS:       'adminSnapshots',
  ADMIN_META:      'adminMeta',
};
