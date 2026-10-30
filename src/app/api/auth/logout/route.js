import { SESSION_COOKIE } from '@/lib/session';

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE.name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
  // Wipe every cookie and all browser storage for this origin, not just the session.
  response.headers.set('Clear-Site-Data', '"cookies", "storage"');
  return response;
}
