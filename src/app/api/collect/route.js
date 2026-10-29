import { timingSafeEqual } from 'crypto';
import { getAdminSession } from '@/lib/requireAdminSession';
import { getDb } from '@/lib/mongo';
import { collect } from '@/lib/collector';

// Runs one change-log pass now (see lib/collector.js). Allowed for a signed-in
// admin, or for a scheduler sending `Authorization: Bearer <CRON_SECRET>` —
// so logging continues even when nobody has the admin open (e.g. a Vercel
// Cron or any uptime pinger hitting this every few minutes).

function hasCronSecret(request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request) {
  if (!hasCronSecret(request) && !(await getAdminSession())) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const db = await getDb();
  const result = await collect(db, { force: true });
  return Response.json(result ?? { skipped: 'Another pass is already running.' });
}

export { handle as GET, handle as POST };
