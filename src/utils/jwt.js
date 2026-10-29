// Access-token timing comes from the token's own claims — the service decides the lifetime, not the client.
const REFRESH_LEAD_MS = 60 * 1000
const REFRESH_FLOOR_MS = 10 * 1000
// setTimeout overflows above this and fires at once; a client clock far behind the server's would spin.
const MAX_TIMER_MS = 2 ** 31 - 1

// When a just-received token expires on this client's clock: its lifetime (`exp` - `iat`) counted from now, so a
// client clock ahead of or behind the server's does not shift it. Without `iat`, `exp` as is; null without `exp`.
export function tokenExpiry(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp, iat } = JSON.parse(atob(payload))
    if (!Number.isFinite(exp)) return null
    return new Date(Number.isFinite(iat) ? Date.now() + (exp - iat) * 1000 : exp * 1000)
  } catch {
    return null
  }
}

// Milliseconds left until a stored expiry (a Date or its cookie string); null when there is none.
function msLeft(expiry) {
  const at = expiry ? new Date(expiry).getTime() : NaN
  return Number.isFinite(at) ? at - Date.now() : null
}

// True when the token is expired or expires within the floor — a request sent with it would arrive stale.
export function expiresSoon(expiry) {
  const left = msLeft(expiry)
  return left !== null && left < REFRESH_FLOOR_MS
}

// Delay of the proactive refresh: 60 s before expiry, never sooner than 10 s; null without a known expiry.
export function refreshDelay(expiry) {
  const left = msLeft(expiry)
  if (left === null) return null
  return Math.min(Math.max(left - REFRESH_LEAD_MS, REFRESH_FLOOR_MS), MAX_TIMER_MS)
}
