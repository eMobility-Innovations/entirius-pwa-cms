import axios from "axios";

// Optional SSO login. The backend exposes two endpoints under VUE_APP_SSO_API_BASE
// (contract: docs/sso-login.md). Plain axios on purpose: the shared API clients
// answer a 401 with a token refresh and a hard redirect, which would swallow the
// login error the operator needs to see.

export const SSO_STATE_KEY = "cms_sso_state";
export const SSO_CALLBACK_PATH = "/sso/callback";

// Read at call time, not at module load, so the flag stays testable.
export const isSsoEnabled = () => Boolean(process.env.VUE_APP_SSO_API_BASE);

export const ssoRedirectUri = () => `${window.location.origin}${SSO_CALLBACK_PATH}`;

const ssoUrl = (path) =>
  `${process.env.VUE_APP_API_URL}${process.env.VUE_APP_SSO_API_BASE.replace(/\/$/, "")}/${path}/`;

// -- POST SSO LOGIN URL → { authorization_url, state }
export const POST_SsoLoginUrl = async ({ redirectUri }) =>
  axios.post(ssoUrl("login-url"), { redirect_uri: redirectUri });

// -- POST SSO CALLBACK → { access, refresh, customer_id, token_type }
export const POST_SsoCallback = async ({ code, state, redirectUri }) =>
  axios.post(ssoUrl("callback"), { code, state, redirect_uri: redirectUri });
