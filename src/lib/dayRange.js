// src/lib/dayRange.js
//
// The admin-wide filters, as URL params (see components/FilterBar.jsx):
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  both inclusive, India Standard Time (every
//                                    store is in India). Default: TODAY only.
//   ?store=<company_id>              default: all stores.
// The range is capped so one request can't pull the whole history at once.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 92;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** IST calendar day of an instant, as YYYY-MM-DD. */
export const istDay = (date) => new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

const istMidnight = (day) => new Date(`${day}T00:00:00+05:30`);

/**
 * @param {URLSearchParams} params
 * @returns {{ from: Date, to: Date, fromDay: string, toDay: string } | { error: string }}
 */
export function parseDayRange(params) {
  const today = istDay(Date.now());
  const toDay = params.get('to') || today;
  const fromDay = params.get('from') || toDay;

  if (!DAY_RE.test(fromDay) || !DAY_RE.test(toDay)) return { error: 'Dates must be YYYY-MM-DD.' };
  const from = istMidnight(fromDay);
  const to = new Date(istMidnight(toDay).getTime() + DAY_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return { error: 'Invalid date.' };
  if (from >= to) return { error: '"From" must be on or before "To".' };
  if (to - from > MAX_DAYS * DAY_MS) return { error: `Pick a range of ${MAX_DAYS} days or less.` };

  return { from, to, fromDay, toDay };
}

/** ?store=<company_id> -> number, or null for all stores. */
export function parseStore(params) {
  const raw = params.get('store');
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}
