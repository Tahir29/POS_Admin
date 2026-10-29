// src/lib/employees.js
//
// employee_id -> name, from LIVE OrnaVerse (Services/HR/Employee/List — the
// same list lucira-pos's checkout "Sales Person" picker reads). Sale records
// store only salesPersonId; this turns it into a name. Cached for an hour;
// an OrnaVerse failure yields an empty map (names fall back to "Employee #id").

import { ornaverseCall } from './ornaverse';

const CACHE_MS = 60 * 60 * 1000;
let cache = null; // { at, map }
let inflight = null;

export async function getEmployeeNames() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.map;
  inflight ??= ornaverseCall('Services/HR/Employee/List', { Skip: 0, Take: 2000 })
    .then((data) => {
      const map = new Map((data?.Entities ?? []).map((e) => [e.employee_id, e.employee_name?.trim() || `Employee #${e.employee_id}`]));
      cache = { at: Date.now(), map };
      return map;
    })
    .catch((err) => {
      console.error('[employees] OrnaVerse employee list unavailable:', err?.message ?? err);
      return new Map();
    })
    .finally(() => { inflight = null; });
  return inflight;
}

/** Salesperson display name for a sale record. */
export function salespersonOf(doc, employees) {
  if (doc.salesPersonName?.trim()) return doc.salesPersonName.trim();
  if (doc.salesPersonId == null) return null;
  return employees.get(doc.salesPersonId) ?? `Employee #${doc.salesPersonId}`;
}
