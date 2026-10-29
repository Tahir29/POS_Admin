import { after } from 'next/server';
import { requireAdminSession } from '@/lib/requireAdminSession';
import { maybeCollect } from '@/lib/collector';
import { getDb } from '@/lib/mongo';
import { loadEvents } from '@/lib/activity';
import { parseDayRange, parseStore } from '@/lib/dayRange';

// Every recorded POS moment for a date range (default today), all stores or
// one (?store=) — see lib/activity.js. ?only=changes keeps just the admin's
// change-log entries (lib/collector.js).
export async function GET(request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const params = new URL(request.url).searchParams;
  const range = parseDayRange(params);
  if (range.error) return Response.json({ error: range.error }, { status: 400 });

  const db = await getDb();
  // Keep the change log current while the admin is in use (throttled to once a minute).
  after(() => maybeCollect(db));
  const { events, truncated, sources } = await loadEvents(db, {
    from: range.from, to: range.to, store: parseStore(params), onlyLogged: params.get('only') === 'changes',
  });
  return Response.json({ rows: events, truncated, sources });
}
