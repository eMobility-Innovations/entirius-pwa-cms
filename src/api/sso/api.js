import axios from "axios"
import { ssoCallbackPath, ssoLoginUrlPath } from '@/configs/sso'

/** Ask the backend where to send the browser. Response: { authorization_url, state }. */
export const POST_SsoLoginUrl = ({ redirect_uri, redirectUri }) =>
  axios.post(`${process.env.VUE_APP_API_URL}${ssoLoginUrlPath()}`, { redirect_uri: redirect_uri || redirectUri })

/** Hand the provider's code back. Response: { access, refresh, customer_id, token_type }. */
export const POST_SsoCallback = ({ code, state, redirect_uri, redirectUri }) =>
  axios.post(`${process.env.VUE_APP_API_URL}${ssoCallbackPath()}`, { code, state, redirect_uri: redirect_uri || redirectUri })

// Upstream imports remain supported; fork config owns the flag and endpoint policy.
export { isSsoEnabled, ssoRedirectUri } from "@/configs/sso";
export { SSO_STATE_KEY } from "@/configs/sso";
export const SSO_CALLBACK_PATH = "/sso/callback";
