// src/lib/session.js
//
// The simple, single-shared-admin-login session this app uses (per its own
// scope — a small trusted team, not a multi-role system like lucira-admin's
// AdminAuthGate). A session token is `base64url(username:expiry).signature`,
// HMAC-SHA256 signed with ADMIN_SESSION_SECRET — no session store, no DB
// round trip to verify a request, just a signature check.
//
// Runs in route handlers (Node.js runtime, not Edge), so Node's `crypto` is
// available — deliberately NOT verified in middleware/proxy.js: lucira-pos's
// own middleware.js carries a comment on exactly why real auth checks don't
// belong at the edge for this app family. Each data route calls
// requireAdminSession() (see that file) itself instead.

import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_COOKIE_NAME = 'pos_admin_session';
// Idle timeout: a token lives 15 minutes and is re-issued only on real user
// activity (POST /api/auth/refresh from IdleLogout.jsx) — never by the
// dashboard's background polling — so an unattended admin logs itself out.
const SESSION_MAX_AGE_SECONDS = 15 * 60;

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error('[lucira-pos-admin] ADMIN_SESSION_SECRET is not set. Add it to .env.local.');
  }
  return secret;
}

function sign(payload) {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

export function createSessionToken(username) {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${username}:${expiresAt}`;
  const encodedPayload = Buffer.from(payload, 'utf8').toString('base64url');
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * @param {string|undefined} token
 * @returns {{ username: string } | null}
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [encodedPayload, signature] = token.split('.');
  const expectedSignature = sign(encodedPayload);

  // Constant-time comparison — a plain `===` here would let a timing attack
  // narrow down the correct signature byte by byte. Both buffers must be
  // the same length for timingSafeEqual, checked first since a mismatched
  // length itself needs no timing protection (it's not part of the secret).
  const actual = Buffer.from(signature ?? '', 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  let payload;
  try {
    payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const separatorIndex = payload.lastIndexOf(':');
  if (separatorIndex === -1) return null;

  const username = payload.slice(0, separatorIndex);
  const expiresAt = Number(payload.slice(separatorIndex + 1));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  // Tokens signed under the old 7-day lifetime are refused rather than honoured for a week.
  if (expiresAt - Date.now() > SESSION_MAX_AGE_SECONDS * 1000) return null;

  return { username };
}

export const SESSION_COOKIE = {
  name: SESSION_COOKIE_NAME,
  maxAge: SESSION_MAX_AGE_SECONDS,
};

/** Set-Cookie value carrying a fresh session token for `username`. */
export function sessionCookieHeader(username) {
  return [
    `${SESSION_COOKIE_NAME}=${createSessionToken(username)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ].filter(Boolean).join('; ');
}
