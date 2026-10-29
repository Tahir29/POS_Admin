import { requireAdminSession } from '@/lib/requireAdminSession';
import { getDb } from '@/lib/mongo';
import { getStores } from '@/lib/stores';

// Every store, for the admin-wide store filter.
export async function GET() {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const db = await getDb();
  return Response.json({ rows: await getStores(db) });
}
