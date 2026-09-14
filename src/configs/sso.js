/**
 * Optional OIDC single sign-on.
 *
 * Everything here is OFF unless VUE_APP_SSO_ENABLED is exactly "true". With the flag off
 * the SSO route is never registered, the button is never rendered and no SSO request is
 * ever sent — a deployment that does not set the variable behaves exactly as before.
 *
 * The browser never holds a client secret: the SPA asks the backend where to send the
 * user, and hands the returned code back to the backend, which performs the code
 * exchange. The two backend paths are configurable so this works against any backend
 * exposing that pair.
 */

// The path the identity provider redirects back to. Fixed, not configurable: it is
// registered with the provider as an exact-match redirect URI, so it cannot vary per
// deployment without re-registering it there.
export const SSO_CALLBACK_ROUTE = "/sso/callback";

const DEFAULT_LOGIN_URL_PATH = "/api/escootersauth/v2/staff/login-url/";
const DEFAULT_CALLBACK_PATH = "/api/escootersauth/v2/staff/callback/";

/** True only for the exact string "true" (any case). Read at call time, so a test can flip it. */
export function isSsoEnabled() {
  return String(process.env.VUE_APP_SSO_ENABLED || "false").toLowerCase() === "true";
}

/**
 * SSO is the ONLY way in: the password form is not rendered and the login wall goes
 * straight to the provider without waiting for a click.
 *
 * Interlocked with the main flag on purpose. "SSO only" while SSO is off would render a
 * login wall with no password form AND no working SSO — a deployment locked out of itself
 * by a single typo in an environment variable.
 */
export function isSsoOnly() {
  if (!isSsoEnabled()) return false;
  return String(process.env.VUE_APP_SSO_ONLY || "false").toLowerCase() === "true";
}

/** Backend endpoint that returns the provider's authorization URL and a state token. */
export function ssoLoginUrlPath() {
  return process.env.VUE_APP_SSO_LOGIN_URL_PATH || DEFAULT_LOGIN_URL_PATH;
}

/** Backend endpoint that exchanges the returned code for the app's own token pair. */
export function ssoCallbackPath() {
  return process.env.VUE_APP_SSO_CALLBACK_PATH || DEFAULT_CALLBACK_PATH;
}

/** The absolute redirect URI sent to the backend — must match what the provider has registered. */
export function ssoRedirectUri() {
  return `${window.location.origin}${SSO_CALLBACK_ROUTE}`;
}

/** Where `state` is parked between leaving for the provider and coming back. */
export const SSO_STATE_KEY = "sso_state";

/**
 * Set when an SSO attempt has just failed, and read before starting an automatic one.
 *
 * Without it, SSO-only mode is a redirect loop: the callback fails, sends the user back to
 * the login wall, and the login wall immediately sends them to the provider again — for
 * ever, with the error never on screen long enough to read. A refused login must land on a
 * page that STAYS, explains itself, and offers a deliberate retry.
 */
export const SSO_AUTOLOGIN_BLOCKED_KEY = "sso_autologin_blocked";

/** Remember that an automatic login must not be started again until the user asks. */
export function blockAutoLogin() {
  try {
    window.sessionStorage.setItem(SSO_AUTOLOGIN_BLOCKED_KEY, "1");
  } catch {
    // Private-mode browsers refuse session storage. See isAutoLoginBlocked for why that
    // is treated as "blocked" rather than "go ahead".
  }
}

/**
 * True when an automatic login must not start.
 *
 * A browser that cannot read session storage also cannot stash `state`, so an automatic
 * login there is guaranteed to fail on return — and would loop. Unreadable storage
 * therefore blocks, and the user gets the button instead.
 */
export function isAutoLoginBlocked() {
  try {
    return window.sessionStorage.getItem(SSO_AUTOLOGIN_BLOCKED_KEY) === "1";
  } catch {
    return true;
  }
}

/** Clear the block — the user has deliberately asked to try again. */
export function allowAutoLogin() {
  try {
    window.sessionStorage.removeItem(SSO_AUTOLOGIN_BLOCKED_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
