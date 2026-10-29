import { requireAdminSession } from '@/lib/requireAdminSession';
import { getDb, COLLECTIONS } from '@/lib/mongo';
import { LIVE_SESSIONS } from '@/lib/live';
import { getStores, headOfficeId } from '@/lib/stores';
import { parseDayRange, parseStore } from '@/lib/dayRange';
import { STATUS_LABEL, resolveSession, sessionStoreLabel, sessionCompanyIds, deviceLabel } from '@/lib/posSessions';

// POS login sessions that STARTED in the date range (default today), all
// stores or one (?store=) — see src/lib/posSessions.js for how status is
// resolved and which store each login counts towards.
export async function GET(request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const params = new URL(request.url).searchParams;
  const range = parseDayRange(params);
  if (range.error) return Response.json({ error: range.error }, { status: 400 });
  const store = parseStore(params);

  const db = await getDb();
  const [rows, stores] = await Promise.all([
    db
      .collection(COLLECTIONS.POS_SESSIONS)
      .find({ ...LIVE_SESSIONS, loginAt: { $gte: range.from, $lt: range.to } })
      .sort({ loginAt: -1 })
      .limit(5000)
      .toArray(),
    getStores(db),
  ]);
  const names = new Map(stores.map((s) => [s.companyId, s.name]));
  const hoId = headOfficeId(stores);

  // Failed logins carry only the typed username — place them at the store
  // that username signs in to successfully.
  const idsByUser = new Map();
  for (const r of rows) {
    if (r.status !== 'failed' && r.username) idsByUser.set(r.username.trim().toLowerCase(), r);
  }

  const now = Date.now();
  const out = [];
  for (const r of rows) {
    const known = r.status === 'failed' ? idsByUser.get(String(r.username ?? '').trim().toLowerCase()) : r;
    const companyIds = known ? sessionCompanyIds(known, hoId) : [];
    if (store != null && !companyIds.includes(store)) continue;

    const { state, endedAt } = resolveSession(r, now);
    const loginAt = new Date(r.loginAt).getTime();
    out.push({
      id: String(r._id),
      store: known ? sessionStoreLabel(known, names, hoId) : null,
      username: r.username ?? null,
      status: STATUS_LABEL[state],
      failureCode: r.failureCode ?? null,
      loginAt: r.loginAt,
      endedAt,
      lastActivityAt: r.status === 'failed' ? null : r.lastActivityAt,
      // Live sessions count up to now; failed attempts have no duration.
      durationMs: state === 'failed' ? null : (endedAt ? endedAt.getTime() : now) - loginAt,
      ip: r.ip ?? null,
      device: deviceLabel(r.userAgent),
    });
  }

  return Response.json({ rows: out });
}
