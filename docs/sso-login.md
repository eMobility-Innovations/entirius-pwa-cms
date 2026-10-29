# SSO Login

Optional. With `VUE_APP_SSO_API_BASE` unset the login wall shows only the
password form and `/sso/callback` redirects to `/`.

The CMS knows no identity provider. It talks to two backend endpoints under
`VUE_APP_API_URL` + `VUE_APP_SSO_API_BASE` (e.g. `/api/<app>/v2/staff`); the
backend runs the OAuth 2.0 authorization-code flow (PKCE, client secret) with
its provider and returns the same SimpleJWT pair as `customer/tokens/`.

## Backend contract

| Method | Path | Body | 200 |
|---|---|---|---|
| POST | `login-url/` | `{ redirect_uri }` | `{ authorization_url, state }` |
| POST | `callback/` | `{ code, state, redirect_uri }` | `{ access, refresh, customer_id, token_type }` |

- Flat JSON, not the `{ data, meta }` envelope. Errors in the v2 envelope
  `{ error, message, debug_id, details }`; `message` is shown to the operator.
- No authentication on either endpoint; they must be throttled server-side.
- `redirect_uri` is always `<CMS origin>/sso/callback`. The backend must accept
  only an allowlisted value and bind it to the `state` it issued.
- `customer_id` must identify a `django_accounts` customer: the CMS loads its
  profile and refreshes / blacklists the token through the accounts endpoints.
- The token's user needs `is_staff` for the admin APIs.

## Flow

1. Login wall → `login-url/` → `state` into `sessionStorage` (`cms_sso_state`)
   → `window.location.assign(authorization_url)`.
2. The provider redirects to `/sso/callback?code=…&state=…` (public route).
3. `SsoCallback.vue` removes the stored state first (single use), refuses a
   missing or different `state` or a provider `error` without calling the
   backend, then posts `callback/`.
4. `useLoginSession().completeLogin()` opens the session exactly as the
   password login does; the view replaces the route with the stored return
   route or `/`.

## Code

`src/api/sso/api.js` (plain axios: the shared clients would turn a 401 into a
refresh + hard redirect), `src/functionals/Login-wall/Login-wall.vue`,
`src/views/SsoCallback/SsoCallback.vue`, `src/composables/useLoginSession.js`.
Tests: `tests/unit/views/SsoCallback/`, `tests/unit/functionals/LoginWall.spec.js`.
