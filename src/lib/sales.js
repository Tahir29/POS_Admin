// src/lib/sales.js
//
// Sales rules for buyerPurchases_POS (one document per invoice / order /
// return / exchange / buyback, written by lucira-pos).
//
// documentStatus: 0 Draft / 1 Posted / 2 Cancelled — the same values
// lucira-pos's own PaymentStatusBadge maps. Older records have no status
// (written before the field existed) and are posted documents.
// Totals count POSTED documents only; cancelled ones are reported separately
// because a bill raised and then cancelled is exactly what an owner wants to
// see. Drafts are never counted.

export const CANCELLED = 2;
export const DRAFT = 0;

/** Mongo match for documents that count towards totals (posted, or pre-status records). */
export const COUNTED = { documentStatus: { $nin: [DRAFT, CANCELLED] } };

export const DOC_TYPES = ['invoice', 'order', 'return', 'exchange', 'buyback'];

export const isCancelled = (d) => d.documentStatus === CANCELLED;
export const isDraft = (d) => d.documentStatus === DRAFT;

export const discountOf = (d) => (d.promotions ?? []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

// lucira-pos sometimes saves a bill at checkout with documentDate = the IST
// wall-clock time written as UTC, i.e. 5h30m late (a 1:37 PM bill reads
// 7:07 PM), until its OrnaVerse sync rewrites the correct value. Such a bill
// is recognisable: documentDate sits exactly 5h30m after createdAt (the
// moment it was saved), so createdAt is the real time. Synced bills keep
// their own documentDate — their createdAt is just the sync time.
export const BILL_SHIFT_MS = 330 * 60 * 1000;
const SHIFT_SLACK_MS = 2 * 60 * 1000;

/** When the bill really happened. */
export function billTime(d) {
  const doc = new Date(d.documentDate);
  const created = d.createdAt ? new Date(d.createdAt) : null;
  if (created && Math.abs(doc - created - BILL_SHIFT_MS) <= SHIFT_SLACK_MS) return created;
  return doc;
}

/** documentDate range that still catches shifted bills of [from, to); filter with billTime afterwards. */
export const billDateRange = (from, to) => ({ ...(from && { $gte: from }), ...(to && { $lt: new Date(to.getTime() + BILL_SHIFT_MS) }) });
