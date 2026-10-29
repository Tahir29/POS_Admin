import { after } from 'next/server';
import { requireAdminSession } from '@/lib/requireAdminSession';
import { maybeCollect } from '@/lib/collector';
import { getDb, COLLECTIONS } from '@/lib/mongo';
import { LIVE_SESSIONS, LIVE_PURCHASES } from '@/lib/live';
import { getStores } from '@/lib/stores';
import { summarizeStoreDays } from '@/lib/storeDays';
import { COUNTED } from '@/lib/sales';
import { parseDayRange, parseStore, istDay } from '@/lib/dayRange';

// One row per store per day in the range (default today) — EVERY store, so a
// store that never logged in shows as such instead of being missing. See
// lib/storeDays.js for how sessions are summarised.
export async function GET(request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const params = new URL(request.url).searchParams;
  const range = parseDayRange(params);
  if (range.error) return Response.json({ error: range.error }, { status: 400 });
  const store = parseStore(params);

  const db = await getDb();
  // Keep the change log current while the admin is in use (throttled to once a minute).
  after(() => maybeCollect(db));
  const [stores, sessions, invoices] = await Promise.all([
    getStores(db),
    db.collection(COLLECTIONS.POS_SESSIONS)
      .find({ ...LIVE_SESSIONS, loginAt: { $gte: range.from, $lt: range.to } })
      .toArray(),
    db.collection(COLLECTIONS.BUYER_PURCHASES)
      // Posted invoices only — cancelled/draft bills never count as sales (lib/sales.js).
      .find({ ...LIVE_PURCHASES, ...COUNTED, documentType: 'invoice', documentDate: { $gte: range.from, $lt: range.to } })
      .toArray(),
  ]);

  const summaries = summarizeStoreDays(sessions, stores);
  const sales = new Map();
  for (const p of invoices) {
    const key = `${p.companyId}|${istDay(p.documentDate)}`;
    const s = sales.get(key) ?? { invoices: 0, sales: 0 };
    s.invoices += 1;
    s.sales += Number(p.totalAmount) || 0;
    sales.set(key, s);
  }

  // Every day in the range, newest first, today never in the future.
  const days = [];
  const today = istDay(Date.now());
  for (let t = range.to.getTime() - 1; t >= range.from.getTime(); t -= 24 * 60 * 60 * 1000) {
    const day = istDay(t);
    if (day <= today) days.push(day);
  }

  const rows = [];
  for (const day of days) {
    for (const s of stores) {
      if (store != null && s.companyId !== store) continue;
      const key = `${s.companyId}|${day}`;
      const sum = summaries.get(key);
      const sale = sales.get(key) ?? { invoices: 0, sales: 0 };
      rows.push({
        id: key,
        companyId: s.companyId,
        store: s.name,
        isHeadOffice: s.isHeadOffice,
        day,
        status: !sum?.logins ? 'Not logged in' : sum.active ? 'Logged in now' : 'Logged out',
        loginIds: sum ? [...sum.loginIds].join(', ') || null : null,
        firstLogin: sum?.firstLogin ? new Date(sum.firstLogin) : null,
        lastLogout: sum?.lastLogout && !sum.active ? new Date(sum.lastLogout) : null,
        lastLogoutReason: sum && !sum.active ? sum.lastLogoutReason : null,
        stillActive: !!sum?.active,
        loggedInMs: sum?.loggedInMs ?? 0,
        logins: sum?.logins ?? 0,
        signedOut: sum?.signedOut ?? 0,
        timedOut: sum?.timedOut ?? 0,
        failed: sum?.failed ?? 0,
        ...sale,
      });
    }
  }

  return Response.json({ rows });
}
