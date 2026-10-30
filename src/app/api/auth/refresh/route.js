// POST — slides the 15-minute idle window forward. Called by IdleLogout.jsx
// only when the admin actually clicks, types or scrolls; background polling
// never calls it, so an unattended tab still expires.

import { getAdminSession } from '@/lib/requireAdminSession';
import { sessionCookieHeader } from '@/lib/session';

export async function POST() {
  const session = await getAdminSession();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', sessionCookieHeader(session.username));
  return response;
}
