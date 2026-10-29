// src/lib/storeDays.js
//
// One summary per store per IST day, from LIVE POS sessions — shared by the
// dashboard's store board and the Store Activity page so both always agree.
//
// "Logged in for" is the UNION of that day's session intervals, so two
// counters logged in at once don't double the hours.
// shortcut: a session is counted on the day it STARTED, even if it runs past
// midnight — fine for store hours; split per day if night shifts ever exist.

import { headOfficeId } from './stores';
import { resolveSession, sessionCompanyIds } from './posSessions';
import { istDay } from './dayRange';

export function mergedMs(intervals) {
  const sorted = intervals.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  if (!sorted.length) return 0;
  let total = 0;
  let [curS, curE] = sorted[0];
  for (const [s, e] of sorted.slice(1)) {
    if (s <= curE) curE = Math.max(curE, e);
    else { total += curE - curS; [curS, curE] = [s, e]; }
  }
  return total + (curE - curS);
}

/**
 * @returns {Map<string, { companyId: number, day: string, logins: number, firstLogin: number|null,
 *   lastLogout: number|null, lastLogoutReason: string|null, active: boolean, signedOut: number,
 *   timedOut: number, failed: number, loginIds: Set<string>, loggedInMs: number }>}
 *   keyed `${companyId}|${day}`
 */
export function summarizeStoreDays(sessions, stores, now = Date.now()) {
  const hoId = headOfficeId(stores);

  // Failed logins carry only the typed username — count them against the
  // store(s) that username signs in to successfully.
  const idsByUser = new Map();
  for (const s of sessions) {
    if (s.status !== 'failed' && s.username) idsByUser.set(s.username.trim().toLowerCase(), sessionCompanyIds(s, hoId));
  }

  const days = new Map();
  const intervals = new Map();
  const row = (companyId, day) => {
    const key = `${companyId}|${day}`;
    if (!days.has(key)) {
      days.set(key, {
        companyId, day, logins: 0, firstLogin: null, lastLogout: null, lastLogoutReason: null, active: false,
        signedOut: 0, timedOut: 0, failed: 0, loginIds: new Set(), loggedInMs: 0,
      });
      intervals.set(key, []);
    }
    return days.get(key);
  };

  for (const s of sessions) {
    const day = istDay(s.loginAt);
    if (s.status === 'failed') {
      for (const id of idsByUser.get(String(s.username ?? '').trim().toLowerCase()) ?? []) row(id, day).failed += 1;
      continue;
    }
    const start = new Date(s.loginAt).getTime();
    const { state, endedAt } = resolveSession(s, now);
    const end = endedAt ? endedAt.getTime() : now;

    for (const id of sessionCompanyIds(s, hoId)) {
      const r = row(id, day);
      r.logins += 1;
      // Same login typed as "Admin" / " admin" (seen live) — one login ID.
      if (s.username?.trim()) r.loginIds.add(s.username.trim().toLowerCase());
      if (r.firstLogin == null || start < r.firstLogin) r.firstLogin = start;
      if (state === 'active') r.active = true;
      else if (r.lastLogout == null || end > r.lastLogout) { r.lastLogout = end; r.lastLogoutReason = state; }
      if (state === 'idle_timeout') r.timedOut += 1;
      if (state === 'manual') r.signedOut += 1;
      intervals.get(`${id}|${day}`).push([start, end]);
    }
  }

  for (const [key, r] of days) r.loggedInMs = mergedMs(intervals.get(key));
  return days;
}
