// Self-check for billTime (no test runner in this repo): node src/lib/sales.check.mjs
import assert from 'node:assert';
import { billTime } from './sales.js';

const iso = (s) => new Date(s).toISOString();
// Bill saved at checkout with the 5h30m shift → real time is createdAt (invoice-2260, 31 Oct 2026).
assert.strictEqual(iso(billTime({ documentDate: '2026-10-31T13:37:49.571Z', createdAt: '2026-10-31T08:07:56.270Z' })), '2026-10-31T08:07:56.270Z');
// Synced bill: createdAt is the later sync time → documentDate stands.
assert.strictEqual(iso(billTime({ documentDate: '2026-10-31T07:59:00.939Z', createdAt: '2026-10-31T08:43:46.027Z' })), '2026-10-31T07:59:00.939Z');
// Bill saved at checkout correctly (seconds apart) → documentDate stands.
assert.strictEqual(iso(billTime({ documentDate: '2026-10-31T07:44:34.735Z', createdAt: '2026-10-31T07:44:36.001Z' })), '2026-10-31T07:44:34.735Z');
// Bill created days before its document date (e.g. an order invoiced later) → documentDate stands.
assert.strictEqual(iso(billTime({ documentDate: '2026-10-20T10:00:00Z', createdAt: '2026-10-14T10:00:00Z' })), '2026-10-20T10:00:00.000Z');
// No createdAt → documentDate.
assert.strictEqual(iso(billTime({ documentDate: '2026-10-31T07:00:00Z' })), '2026-10-31T07:00:00.000Z');
console.log('billTime: all checks pass');
