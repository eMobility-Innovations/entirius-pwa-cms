import { ssoApi } from './client'
import { ssoCallbackPath, ssoLoginUrlPath } from '@/configs/sso'

/** Ask the backend where to send the browser. Response: { authorization_url, state }. */
export const POST_SsoLoginUrl = ({ redirect_uri }) =>
  ssoApi.post(ssoLoginUrlPath(), { redirect_uri })

/** Hand the provider's code back. Response: { access, refresh, customer_id, token_type }. */
export const POST_SsoCallback = ({ code, state, redirect_uri }) =>
  ssoApi.post(ssoCallbackPath(), { code, state, redirect_uri })
