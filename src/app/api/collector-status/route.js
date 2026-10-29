import { requireAdminSession } from '@/lib/requireAdminSession';
import { getDb, COLLECTIONS } from '@/lib/mongo';

// When the change-log collector (lib/collector.js) last ran, for the Change Log page.
export async function GET() {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const db = await getDb();
  const meta = await db.collection(COLLECTIONS.ADMIN_META).findOne({ _id: 'collector' });
  return Response.json({ lastRunAt: meta?.lastRunAt ?? null, lastLogged: meta?.lastLogged ?? 0 });
}
