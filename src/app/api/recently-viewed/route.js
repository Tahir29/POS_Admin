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
    .collection(COLLECTIONS.RECENTLY_VIEWED)
    .find({})
    .sort({ updatedAt: -1 })
    .limit(1000)
    .toArray();

  return Response.json({
    rows: rows.filter((r) => isLiveRecord(live, r.party_id, r.customerMobile)).map((r) => ({
      partyId:        r.party_id,
      customerName:   r.customerName,
      customerMobile: r.customerMobile,
      itemCount:      Array.isArray(r.items) ? r.items.length : 0,
      updatedAt:      r.updatedAt ?? null,
      createdAt:      r.createdAt ?? null,
    })),
  });
}
