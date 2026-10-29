export const money = (n) =>
  n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// "29 Oct 2026, 11:33 am" in India time (every store is in India) — no
// seconds, so date columns stay narrow enough to fit laptop-width tables.
export const dateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : '—';

export const dash = (v) => (v == null || v === '' ? '—' : v);

export const duration = (ms) => {
  if (ms == null || ms < 0) return '—';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

// Last 10 digits — how lucira-pos keys a customer across its collections
// (same rule as its own lib/mongo/normalizeMobile.js).
export const mobileKey = (mobile) => {
  if (!mobile) return null;
  const digits = String(mobile).replace(/\D/g, '');
  return digits.length < 10 ? null : digits.slice(-10);
};

export const journeyHref = (mobile) => {
  const key = mobileKey(mobile);
  return key ? `/dashboard/journey/${key}` : null;
};

// A customer's timeline opened on the IST day of a given event (the timeline
// defaults to today, which would hide the event being clicked through from).
export const customerDayHref = (mobile, at) => {
  if (!mobile) return null;
  const day = at ? new Date(new Date(at).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10) : null;
  return `/dashboard/journey/${mobile}${day ? `?day=${day}` : ''}`;
};
