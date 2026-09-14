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
