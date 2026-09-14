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
 * Absent, not disabled: VUE_APP_HIDE_DISABLED_PANELS is unset on these hosts, so a
 * "disabled" panel still renders as a visible greyed tile.
 */
export function isAccessPanelVisibleFor(panelIdx, accessStore) {
  if (panelIdx !== ACCESS_PANEL_IDX) return true;
  return !!accessStore?.canRead;
}
