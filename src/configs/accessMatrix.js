/**
 * Optional access-matrix administration panel.
 *
 * Everything here is OFF unless VUE_APP_ACCESS_PANEL_ENABLED is exactly "true". With the
 * flag off the routes are never registered, the panel entry is never added and no request
 * is ever sent — a deployment that does not set the variable behaves exactly as before.
 *
 * The base path is configurable so this overlay names no particular backend: any service
 * exposing the same shape can be pointed at.
 */

const DEFAULT_API_BASE = "/api/escaccess/v2";

/** True only for the exact string "true" (any case). Read at call time, so a test can flip it. */
export function isAccessPanelEnabled() {
  return String(process.env.VUE_APP_ACCESS_PANEL_ENABLED || "false").toLowerCase() === "true";
}

export function accessApiBase() {
  return process.env.VUE_APP_ACCESS_API_BASE || DEFAULT_API_BASE;
}

/** The panel's idx in configs/access.js and the route it opens on. */
export const ACCESS_PANEL_IDX = "access";
export const ACCESS_ROUTE_ROOT = "/access/grants";

/**
 * Whether a panel entry may be DRAWN for the person currently logged in.
 *
 * Only the access panel is ever filtered here — every other panel keeps whatever Munin
 * and the host environment said about it. The access panel is different because
 * `isPanelEnabled` answers a question about the HOST ("is this deployment running the
 * matrix?") and the nav needs the answer to a question about the PERSON ("may they read
 * it?"). Those came apart silently: the registry entry carries `access: ["admin"]`, which
 * reads like a gate but is consulted by nothing.
 *
 * It is `page:access` and not a role name, because permissions are per-user overridable —
 * somebody may hold the page without the role, or the role without the page.
 *
 * Absent, not disabled — and the reason is NOT the hide-disabled flag. MEASURED on
 * CT228 2026-09-14: CMS_HIDE_DISABLED_PANELS=true, so that host DOES hide disabled
 * panels. It would still not have hidden this one, because PR #5 puts `access` into the
 * env panel set, so `isPanelEnabled("access")` is true for every user on a host running
 * the panel and HIDE_DISABLED never reaches it. Marking the entry disabled hides it from
 * nobody; it has to leave the list. On a host that leaves the variable unset (default
 * false) a disabled panel is drawn as a visible greyed tile anyway — so removal is the
 * only thing that works on both.
 */
export function isAccessPanelVisibleFor(panelIdx, accessStore) {
  if (panelIdx !== ACCESS_PANEL_IDX) return true;
  return !!accessStore?.canRead;
}
