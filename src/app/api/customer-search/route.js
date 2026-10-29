import { requireAdminSession } from '@/lib/requireAdminSession';
import { getLiveCustomerList, LIVE_CHECK_FAILED } from '@/lib/liveCustomers';

// Type-ahead customer search over every LIVE OrnaVerse customer, by name or
// mobile (any part of either). ?q= needs 2+ characters; best matches first:
// starts-with beats contains, then A–Z. Only customers with a mobile are
// returned — a customer's timeline is keyed by mobile.

const MAX_RESULTS = 20;

export async function GET(request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 50);
  if (q.length < 2) return Response.json({ rows: [] });

  let list;
  try {
    list = await getLiveCustomerList();
  } catch (err) {
    console.error('[customer-search]', err?.message ?? err);
    return Response.json({ error: LIVE_CHECK_FAILED }, { status: 502 });
  }

  // Mobile-style queries ("98201", "+91 98201") match on digits only; a typed
  // "+91" country code is dropped since stored mobiles are the last 10 digits.
  const qDigits = q.replace(/\D/g, '').replace(q.startsWith('+') ? /^91/ : /^$/, '');
  const isNumber = qDigits.length >= 2 && /^[\d\s+()-]+$/.test(q);

  const scored = [];
  for (const c of list) {
    if (!c.mobile) continue;
    const name = c.name?.toLowerCase() ?? '';
    let score = -1;
    if (isNumber) {
      if (c.mobile.startsWith(qDigits)) score = 0;
      else if (c.mobile.includes(qDigits)) score = 1;
    } else if (name.startsWith(q) || name.split(/\s+/).some((w) => w.startsWith(q))) score = 0;
    else if (name.includes(q)) score = 1;
    if (score >= 0) scored.push({ score, c });
  }

  scored.sort((a, b) => a.score - b.score || (a.c.name ?? '').localeCompare(b.c.name ?? ''));
  return Response.json({
    rows: scored.slice(0, MAX_RESULTS).map(({ c }) => ({ partyId: c.partyId, name: c.name, mobile: c.mobile })),
    total: scored.length,
  });
}
