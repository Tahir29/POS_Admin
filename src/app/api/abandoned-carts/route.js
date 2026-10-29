import { requireAdminSession } from '@/lib/requireAdminSession';
import { getDb, COLLECTIONS } from '@/lib/mongo';

export async function GET() {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const db = await getDb();
  const rows = await db
    .collection(COLLECTIONS.ABANDONED_CARTS)
    .find({})
    .sort({ updatedAt: -1 })
    .limit(1000)
    .toArray();

  return Response.json({
    rows: rows.map((r) => ({
      partyId:        r.party_id,
      customerName:   r.customerName,
      customerMobile: r.customerMobile,
      companyId:      r.company_id ?? null,
      itemCount:      Array.isArray(r.items) ? r.items.length : 0,
      subtotal:       r.subtotal ?? null,
      taxAmount:      r.taxAmount ?? null,
      total:          r.total ?? null,
      updatedAt:      r.updatedAt ?? null,
      createdAt:      r.createdAt ?? null,
    })),
  });
}
