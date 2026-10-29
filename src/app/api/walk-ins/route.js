import { requireAdminSession } from '@/lib/requireAdminSession';
import { ornaverseCall } from '@/lib/ornaverse';
import { parseDayRange, parseStore } from '@/lib/dayRange';

// CRM.CustomerVisitsRow — confirmed live against UAT (2026-08-31) via
// Services/CRM/CustomerVisits/List. Two things confirmed at the same time,
// worth keeping in mind if this ever needs revisiting:
//   - `company_id` in the request body does NOT actually scope the
//     results — same non-functional filter already found on POS/Order/List
//     earlier in this project's life. Every row comes back regardless of
//     what's passed, so this route doesn't bother sending it at all.
//   - Sort must be the string form, `['date DESC']` (what lucira-pos's own
//     crmService.getCustomerVisits sends) — the object form
//     `[{Field:'date', Descending:true}]` 500s. Without it OrnaVerse returns
//     OLDEST first, so once LIVE passes Take visits the newest would vanish.
// LIVE had 4,388 visits on 2026-10-29; Take keeps the newest 5000.
// Filtered here to the admin-wide date range (default today) and ?store=.
export async function GET(request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const params = new URL(request.url).searchParams;
  const range = parseDayRange(params);
  if (range.error) return Response.json({ error: range.error }, { status: 400 });
  const store = parseStore(params);

  let data;
  try {
    data = await ornaverseCall('Services/CRM/CustomerVisits/List', { Skip: 0, Take: 5000, Sort: ['date DESC'] });
  } catch (err) {
    console.error('[api/walk-ins]', err);
    return Response.json({ error: 'Failed to load walk-ins from OrnaVerse.' }, { status: 502 });
  }

  const inRange = (d) => d && new Date(d) >= range.from && new Date(d) < range.to;
  const entities = (data?.Entities ?? []).filter((e) => inRange(e.date) && (store == null || e.company_id === store));
  return Response.json({
    rows: entities.map((e) => ({
      id:          e.id,
      customerName: e.customer_name ?? null,
      mobile:      e.mobile ?? null,
      email:       e.email ?? null,
      store:       e.mailing_name ?? e.company_name ?? null,
      source:      e.source ?? null,
      date:        e.date ?? null,
    })),
  });
}
