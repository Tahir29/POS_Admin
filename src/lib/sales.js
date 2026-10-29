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
