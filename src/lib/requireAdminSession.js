// src/lib/requireAdminSession.js
//
// The REAL security boundary for this app's data routes — not the client-
// side layout gate (AdminAuthGate.jsx), which only redirects the UI for a
// logged-out visitor's convenience. Every API route that touches Mongo
// calls this FIRST, so the data is actually protected even if someone
// requests the route directly rather than clicking through the UI.

import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from './session';

/**
 * @returns {Promise<{ username: string } | null>}
 */
export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE.name)?.value;
  return verifySessionToken(token);
}

/**
 * Call at the top of every protected route handler. Returns a 401 Response
 * to return immediately when there's no valid session, or null when the
 * caller is authenticated and the route should proceed.
 *
 * @returns {Promise<Response | null>}
 */
export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return null;
}
