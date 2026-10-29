// GET — lets the client-side layout gate (AdminAuthGate) ask "am I logged
// in?" without ever needing to read the httpOnly session cookie itself.

import { getAdminSession } from '@/lib/requireAdminSession';

export async function GET() {
  const session = await getAdminSession();
  return Response.json({ authenticated: !!session, username: session?.username ?? null });
}
