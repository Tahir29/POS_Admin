import { requireAdminSession } from '@/lib/requireAdminSession';
import { getDb, COLLECTIONS } from '@/lib/mongo';
import { getLiveCustomers, isLiveRecord, LIVE_CHECK_FAILED } from '@/lib/liveCustomers';

export async function GET() {
  const authError = await requireAdminSession();
  if (authError) return authError;

  // LIVE only — this collection has no environment field (lib/liveCustomers.js).
  let live;
  try {
    live = await getLiveCustomers();
  } catch (err) {
    console.error('[live check]', err?.message ?? err);
    return Response.json({ error: LIVE_CHECK_FAILED }, { status: 502 });
  }

  const db = await getDb();
  const rows = await db
    .collection(COLLECTIONS.CUSTOMERS)
    .find({})
    .sort({ syncedAt: -1 })
    .limit(5000)
    .toArray();

  // `profile` is the raw OrnaVerse CustomerRow mirror (minus PAN — see
  // lucira-pos's own customerProfile.js header for why that's excluded at
  // write time, not just at read time here) — field names confirmed
  // against that same repo's normalizers/customer.js.
  return Response.json({
    rows: rows.filter((r) => isLiveRecord(live, r.party_id, r.profile?.mobile)).map((r) => {
      const p = r.profile ?? {};
      return {
        partyId:  r.party_id,
        name:     p.party_name ?? null,
        mobile:   p.mobile ?? null,
        email:    p.email && p.email !== 'NA' ? p.email : null,
        city:     p.city_name ?? null,
        state:    p.state_name ?? null,
        birthDate: p.birth_date ?? null,
        syncedAt: r.syncedAt ?? null,
      };
    }),
  });
}
