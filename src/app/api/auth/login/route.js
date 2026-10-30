// POST — checks the submitted credentials against the single shared admin
// login (ADMIN_USERNAME/ADMIN_PASSWORD, see .env.local) and, on success,
// sets the signed session cookie every other route checks.

import { sessionCookieHeader } from '@/lib/session';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { username, password } = body ?? {};
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return Response.json(
      { error: 'Admin credentials are not configured on the server.' },
      { status: 500 }
    );
  }

  if (username !== expectedUsername || password !== expectedPassword) {
    return Response.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', sessionCookieHeader(username));
  return response;
}
