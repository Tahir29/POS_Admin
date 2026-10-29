// src/lib/posSessions.js
//
// Shared reading rules for posSessions_POS, written by lucira-pos's own
// src/lib/mongo/posSessions.js (see its header for what each field means
// and why each is trustworthy). Used by the sessions table, the activity
// feed and the per-store daily summary, so all three agree on status.
//
// A session with no explicit end (tab closed, device asleep) stays 'active'
// in Mongo forever — it's resolved HERE: once lastActivityAt + its own
// idleTimeoutMs has passed, the POS server would already refuse it, so it
// counts as timed out at exactly that moment.

import { storeName } from './stores';

export const STATUS_LABEL = {
  active: 'Active now',
  manual: 'Signed out',
  idle_timeout: 'Timed out (idle)',
  failed: 'Failed login',
};

/** @returns {{ state: 'active'|'manual'|'idle_timeout'|'failed', endedAt: Date|null }} */
export function resolveSession(r, now = Date.now()) {
  if (r.status === 'failed') return { state: 'failed', endedAt: null };
  if (r.status === 'ended') return { state: r.endReason ?? 'manual', endedAt: new Date(r.endedAt) };
  const expiresAt = new Date(r.lastActivityAt).getTime() + (r.idleTimeoutMs ?? 0);
  return expiresAt <= now
    ? { state: 'idle_timeout', endedAt: new Date(expiresAt) }
    : { state: 'active', endedAt: null };
}

// A store login covers its own store — or two, e.g. "chembur" covers Chembur
// FOCO + Chembur CoCo. The super-admin login can open every store; it's a
// Head Office login, so it's attributed to Head Office — otherwise an admin
// sign-in would make every store look "logged in".
const isAdminSession = (r) => (r.stores?.length ?? 0) > 2;

/** company_ids this session counts towards. */
export function sessionCompanyIds(r, hoId) {
  if (!r.stores?.length) return [];
  return isAdminSession(r) ? [hoId] : r.stores.map((s) => s.companyId);
}

export function sessionStoreLabel(r, names, hoId) {
  if (!r.stores?.length) return null;
  if (isAdminSession(r)) return `${storeName(names, hoId)} (admin login)`;
  return r.stores.map((s) => storeName(names, s.companyId)).join(' + ');
}

// "Chrome · Windows" — enough to tell counter devices apart at a glance.
export function deviceLabel(ua) {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser';
  const os = /iPad/.test(ua) ? 'iPad'
    : /iPhone/.test(ua) ? 'iPhone'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'Mac'
    : /Linux/.test(ua) ? 'Linux'
    : 'Unknown OS';
  return `${browser} · ${os}`;
}
