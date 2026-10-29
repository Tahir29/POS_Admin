// POST — checks the submitted credentials against the single shared admin
// login (ADMIN_USERNAME/ADMIN_PASSWORD, see .env.local) and, on success,
// sets the signed session cookie every other route checks.

import { createSessionToken, SESSION_COOKIE } from '@/lib/session';

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

  const token = createSessionToken(username);
  const response = Response.json({ ok: true });
  response.headers.append(
    'Set-Cookie',
    [
      `${SESSION_COOKIE.name}=${token}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      process.env.NODE_ENV === 'production' ? 'Secure' : '',
      `Max-Age=${SESSION_COOKIE.maxAge}`,
    ].filter(Boolean).join('; ')
  );
  return response;
}
