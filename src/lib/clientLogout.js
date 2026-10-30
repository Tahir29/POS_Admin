// Client-side logout used by the sidebar button and the idle timer: ends the
// server session, wipes everything this origin stored in the browser, and
// lands on /login. The logout route also sends Clear-Site-Data; the explicit
// clears below cover browsers that ignore that header.
export async function clientLogout(reason) {
  // Clear before the request: clearing a non-empty localStorage is what tells
  // other open admin tabs (IdleLogout's storage listener) to log out too.
  try { localStorage.clear(); } catch { /* storage blocked */ }
  try { sessionStorage.clear(); } catch { /* storage blocked */ }
  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* cookie still expires on its own */ }
  window.location.replace(reason ? `/login?reason=${reason}` : '/login');
}
