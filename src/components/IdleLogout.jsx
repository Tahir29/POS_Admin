'use client';

import { useEffect } from 'react';
import { clientLogout } from '@/lib/clientLogout';

// Logs the admin out after 15 minutes without a click, key press, scroll or
// touch. Activity also renews the server session (at most once a minute) —
// the server-side expiry in lib/session.js is the real boundary; this just
// makes the logout visible instead of leaving a page full of 401s.
// The last-activity time is shared through localStorage, so working in one
// tab keeps the other open tabs signed in too.
const IDLE_MS = 15 * 60 * 1000;
const RENEW_EVERY_MS = 60 * 1000;
const KEY = 'pos_admin_last_activity';
const EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'];

const readShared = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };
const writeShared = (t) => { try { localStorage.setItem(KEY, String(t)); } catch { /* private mode: per-tab only */ } };

export default function IdleLogout() {
  useEffect(() => {
    let last = Date.now();
    let lastRenew = Date.now(); // the page load itself was just authenticated
    let done = false;
    writeShared(last);

    const logout = () => {
      if (done) return;
      done = true;
      clientLogout('idle');
    };

    // Another tab logged out (clientLogout clears localStorage, removing KEY): follow it.
    const onStorage = (e) => {
      if ((e.key === KEY || e.key === null) && e.newValue === null && !done) {
        done = true;
        window.location.replace('/login');
      }
    };

    const onActivity = () => {
      const now = Date.now();
      last = now;
      writeShared(now);
      if (now - lastRenew >= RENEW_EVERY_MS) {
        lastRenew = now;
        fetch('/api/auth/refresh', { method: 'POST' })
          .then((res) => { if (res.status === 401) logout(); })
          .catch(() => {});
      }
    };

    // Wall-clock check, so a laptop waking from sleep logs out immediately.
    const check = () => {
      const latest = Math.max(last, readShared());
      if (Date.now() - latest >= IDLE_MS) logout();
    };

    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', check);
    window.addEventListener('storage', onStorage);
    const timer = setInterval(check, 15 * 1000);
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('storage', onStorage);
      clearInterval(timer);
    };
  }, []);

  return null;
}
