// src/lib/ornaverse.js
//
// This app's OWN OrnaVerse OAuth client — server-side only (route handlers,
// Node.js runtime, so a cached in-memory token survives across requests the
// same way src/lib/mongo.js's connection promise does). Deliberately not
// imported from, or shared with, lucira-pos's own axios/token-refresh code
// (src/lib/axios/interceptors.js there): that one exists to authenticate
// whichever OPERATOR is signed into a specific store counter; this one
// authenticates as this admin panel's own service client and never changes
// per visitor.
//
// LIVE only — this admin never reads UAT. LIVE's OAuth client is
// confidential: `client_credentials` grant, client_id:secret as HTTP Basic
// auth, and it rejects the offline_access scope (confirmed in lucira-pos's
// own 2026-08-22 LIVE cutover).

let cachedToken = null; // { accessToken, expiresAt }

function getBaseUrl() {
  const baseUrl = process.env.ORNAVERSE_LIVE_BASE_URL;
  if (!baseUrl) {
    throw new Error('[lucira-pos-admin] ORNAVERSE_LIVE_BASE_URL is not set in .env.local');
  }
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function buildTokenRequest() {
  const clientId = process.env.ORNAVERSE_LIVE_CLIENT_ID;
  const clientSecret = process.env.ORNAVERSE_LIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('[lucira-pos-admin] ORNAVERSE_LIVE_CLIENT_ID/SECRET must be set in .env.local');
  }
  const params = new URLSearchParams({ grant_type: 'client_credentials', scope: 'profile email' });
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
  };
  return { params, headers };
}

async function fetchNewToken() {
  const { params, headers } = buildTokenRequest();
  const res = await fetch(`${getBaseUrl()}connect/token`, {
    method: 'POST',
    headers,
    body: params,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`[lucira-pos-admin] OrnaVerse token request failed: ${JSON.stringify(data)}`);
  }

  // expires_in is in seconds — refresh a little early (60s) rather than
  // risk a request landing right at expiry.
  const expiresAt = Date.now() + (Number(data.expires_in ?? 3600) - 60) * 1000;
  return { accessToken: data.access_token, expiresAt };
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }
  cachedToken = await fetchNewToken();
  return cachedToken.accessToken;
}

/**
 * POSTs to an OrnaVerse Services/* endpoint with this app's own service
 * token, retrying ONCE with a fresh token on a 401 (covers a token that
 * expired between the cache check and the actual request).
 *
 * @param {string} path — e.g. 'Services/CRM/CustomerVisits/List'
 * @param {object} body
 */
export async function ornaverseCall(path, body) {
  const baseUrl = getBaseUrl();
  const doCall = async (token) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    return res;
  };

  let token = await getAccessToken();
  let res = await doCall(token);

  if (res.status === 401) {
    cachedToken = null;
    token = await getAccessToken();
    res = await doCall(token);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`[lucira-pos-admin] OrnaVerse ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}
