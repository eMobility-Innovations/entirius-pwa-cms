import axios from 'axios'
import Cookies from 'universal-cookie'
import { expiresSoon, tokenExpiry } from '@/utils/jwt'
import { useNotifyStore } from '@/stores/notify'
import { t } from '@/i18n'

const debugMode = JSON.parse((process.env.VUE_APP_DEBUG || 'false').toLowerCase())
const cookies = new Cookies()
const _CHANNEL = process.env.VUE_APP_CHANNEL

let refreshPromise = null
// Bumped by every logout: a refresh that started under an older generation drops its answer.
let sessionGeneration = 0

/**
 * A refresh that settled after a logout, answered or failed: nothing expired, the session had already ended.
 * It is not an error to report: the refresh paths neither log out again nor redirect, and a request waiting on that
 * refresh never sees it — the interceptors leave that request pending (`refreshOrLogout`), so no caller toasts it.
 */
export class SessionEndedError extends Error {}

function clearAllCookies() {
  const allCookies = cookies.getAll()
  Object.keys(allCookies).forEach((name) => {
    cookies.remove(name, { path: '/' })
  })
}

// Only a visit that held a session was logged out: a first visit (no token cookie) meets a plain login screen.
function sessionExpiredRedirect() {
  if (cookies.get('token')) localStorage.setItem('session_expired', '1')
  localStorage.setItem('cms_return_route', window.location.pathname + window.location.search)
  clearAllCookies()
  window.location.href = '/'
}

// The unwrapped v2 body carries no HTTP status (a 409 reads INVALID_REQUEST) — keep it as a
// non-enumerable `httpStatus` so callers can tell a conflict apart (isConflict).
function rejectWithBody(err) {
  const body = err.response.data
  if (body && typeof body === 'object') {
    Object.defineProperty(body, 'httpStatus', { value: err.response.status, configurable: true })
  }
  return Promise.reject(body || err)
}

// The access gate's refusal (django-access): the v2 PERMISSION_DENIED envelope with one of the gate's issues.
const ACCESS_ISSUES = ['ACCESS_DENIED', 'STAFF_ONLY', 'UNMAPPED_ROUTE']
export const isAccessRefusal = (body) =>
  body?.error === 'PERMISSION_DENIED' && Array.isArray(body.details) && body.details.some((d) => ACCESS_ISSUES.includes(d?.issue))

// Resolved at call time like the user store: the access store imports an API client built here.
async function refreshAccess() {
  const { useAccessStore } = await import('@/stores/access')
  return useAccessStore().refresh()
}

// One standard toast per burst and one throttled `me` refresh; the rejection still reaches the view, marked
// `accessHandled` — its own toast (the server text, or any text right after the refusal) is covered by the standard one.
function announceAccessRefusal(body) {
  Object.defineProperty(body, 'accessHandled', { value: true, configurable: true })
  useNotifyStore().spawnNotification({
    type: 'negative',
    msg: t('access.denied_action'),
    covers: [t('access.denied_action'), body.message],
  })
  refreshAccess().catch(() => {})
}

export const isConflict = (err) => (err?.httpStatus ?? err?.response?.status) === 409
export const isNotFound = (err) => (err?.httpStatus ?? err?.response?.status) === 404

// The single token refresh: the 401 retry, the pre-request check and the user store's timer share one
// in-flight call, so a rotated refresh token is never sent twice.
export function refreshAccessToken() {
  if (!refreshPromise) {
    const promise = postRefresh().finally(() => {
      if (refreshPromise === promise) refreshPromise = null
    })
    refreshPromise = promise
  }
  return refreshPromise
}

// The user store's logout calls this: the in-flight refresh is dropped, and the next session never joins it.
export function endRefreshSession() {
  sessionGeneration += 1
  refreshPromise = null
}

// Resolved at call time: the store imports the API clients, so a static import here would make building a client
// depend on which module loaded first.
async function userStore() {
  const { useUserStore } = await import('@/stores/user')
  return useUserStore()
}

function assertSameSession(generation) {
  if (generation !== sessionGeneration) throw new SessionEndedError('Logged out during the token refresh')
}

// A logout while the POST was in flight turns either outcome into SessionEndedError: a refresh token blacklisted
// by that logout answers 401, and that is not an expired session.
async function postInSession(url, body, generation) {
  try {
    return await axios.post(url, body)
  } catch (error) {
    assertSameSession(generation)
    throw error
  }
}

// Every refresh lands in the store's `setAuth`, which stores the pair and re-arms the one refresh timer — unless
// the user logged out while the request was in flight: then the answer is dropped and nothing is written.
async function postRefresh() {
  const generation = sessionGeneration
  const refreshCookie = cookies.get('refresh')
  if (!refreshCookie) throw new Error('No refresh token')

  const url = `${process.env.VUE_APP_API_URL}/api/accounts/v1/${_CHANNEL ?? ''}/customer/tokens/refresh/`
  const { data } = await postInSession(url, { refresh: refreshCookie }, generation)
  const store = await userStore()
  assertSameSession(generation)
  const { access, refresh } = data.data || data

  // The API only returns a new refresh token when rotation is enabled server-side — keep the old one otherwise.
  store.setAuth({ token: access, refresh: refresh || refreshCookie, expiryDate: tokenExpiry(access) })
  return access
}

// Shared by both interceptors (the 401 retry and the pre-request check). A request waiting on a refresh of an ended
// session is abandoned, not rejected: its promise never settles. The user logged out and is on the way to the login
// screen, the waiting components unmount — a rejection would reach ~280 call sites that toast on any error.
async function refreshOrLogout() {
  try {
    return await refreshAccessToken()
  } catch (error) {
    if (error instanceof SessionEndedError) return new Promise(() => {})
    sessionExpiredRedirect()
    throw error
  }
}

// A cold load can hold a token that expired while the tab was closed. Munin answers it anonymously instead of
// with a 401, so the 401 retry never runs and admin panels vanish — refresh before sending instead.
async function refreshIfExpiring() {
  if (cookies.get('refresh') && expiresSoon(cookies.get('expiryDate'))) {
    await refreshOrLogout()
  }
}

function attachTokenRefresh(client) {
  client.interceptors.response.use(
    (res) => res,
    async (err) => {
      const originalConfig = err.config

      if (!err.response) return Promise.reject(err)

      // 403 = permission denied (not session expired) — do NOT logout
      if (err.response.status === 403) {
        if (isAccessRefusal(err.response.data)) announceAccessRefusal(err.response.data)
        return rejectWithBody(err)
      }

      if (err.response.status !== 401 || originalConfig._retry) {
        return rejectWithBody(err)
      }

      // 401 — attempt token refresh
      originalConfig._retry = true
      const access = await refreshOrLogout()

      client.defaults.headers.common.Authorization = `Bearer ${access}`
      originalConfig.headers.Authorization = `Bearer ${access}`
      return client(originalConfig)
    }
  )
}

// A request flagged `sensitive` (the login call: a password and the answered token pair; the access token calls: a
// create or rotate answer holds a raw token) never has its body in the debug log, the request's or the response's.
// The token refresh and the logout go through plain `axios`, which no debug interceptor sees.
const REDACTED = '[redacted]'
const debugBody = (config, data) => (config?.sensitive ? REDACTED : data)

export function createApiClient(baseURL, { authHeaderFn = null, tokenRefresh = false } = {}) {
  const client = axios.create({ baseURL })

  if (authHeaderFn) {
    client.interceptors.request.use(async (request) => {
      if (tokenRefresh) await refreshIfExpiring()
      const authHeader = authHeaderFn()
      if (authHeader) {
        request.headers.Authorization = authHeader
      }
      return request
    })
  }

  if (tokenRefresh) {
    attachTokenRefresh(client)
  }

  if (debugMode) {
    client.interceptors.request.use((request) => {
      console.log(`%c${process.env.NODE_ENV} - REQUEST`, 'color:#68baaf')
      console.log(request.method?.toUpperCase(), request.url, debugBody(request, request.data))
      return request
    })

    client.interceptors.response.use((response) => {
      console.log(`%c${response.config.url}`, 'color:#307a54;background:#aeebcc')
      console.log(`status: %c${response.status}`, 'color:#68baaf')
      console.log(debugBody(response.config, response.data))
      return response
    })
  }

  return client
}
