import { requireAdminSession } from '@/lib/requireAdminSession';
import { getDb } from '@/lib/mongo';
import { loadEvents } from '@/lib/activity';

// One customer's whole recorded history, newest first — see lib/activity.js.
export async function GET(request, { params }) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const { mobile } = await params;
  if (!/^\d{10}$/.test(mobile)) {
    return Response.json({ error: 'Expected a 10-digit mobile number.' }, { status: 400 });
  }

  const db = await getDb();
  const { events, truncated, sources } = await loadEvents(db, { mobile });
  return Response.json({ rows: events, truncated, sources });
}
