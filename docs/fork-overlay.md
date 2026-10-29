# Fork overlay after upstream 3.3.0

This fork adopts upstream 3.3.0 while retaining organization-specific behavior. A
closed upstream PR does not necessarily mean its behavior was merged. The decisions
below follow the maintainers' comments and the operator's withdrawal, not PR titles.

| Upstream PR | Outcome | Adoption decision |
| --- | --- | --- |
| [#38: Switcher and synchronous login](https://github.com/entirius/entirius-pwa-cms/pull/38) | Closed. `Switcher` was replaced by accessible `BasicSwitch`; synchronous registration was incorporated through #77. | Adopt upstream components and registration; do not restore the obsolete Switcher. |
| [#41: optional OIDC](https://github.com/entirius/entirius-pwa-cms/pull/41) | Closed because upstream already implements the same backend flow. The maintainer identified SSO-only mode as additional functionality. | Adopt upstream login-session initialization; retain SSO-only behavior in this fork. |
| [#42: web-storage test shim](https://github.com/entirius/entirius-pwa-cms/pull/42) | Closed: upstream's Node 24 suite passed without the shim; a standalone shim was invited if a newer runtime reproduces the issue. | Keep the guarded test-only fallback for runtimes without usable storage. |
| [#43: scrolling documentation](https://github.com/entirius/entirius-pwa-cms/pull/43) | Closed after its generic lesson was incorporated and updated through #78. | Adopt the current `PageLayout` contract, rather than obsolete 2.1 shell classes. |
| [#44: scrolling regression](https://github.com/entirius/entirius-pwa-cms/pull/44) | Withdrawn by the operator because its panel fixture belongs to the fork. | Retain and adapt the browser regression in the fork; withdrawal does not authorize deleting it. |
| [#59: upstream Access](https://github.com/entirius/entirius-pwa-cms/pull/59) | Merged: upstream authorization, read-only behavior, and administration UI. | Adopt upstream authorization interfaces, selecting the organization matrix as the sole authority when its flag is enabled. |
| [#77: synchronous login components](https://github.com/entirius/entirius-pwa-cms/pull/77) | Merged, including `FormField` and `IconButton`. | Use upstream registration and its real login-wall regression. |
| [#78: page scrolling documentation](https://github.com/entirius/entirius-pwa-cms/pull/78) | Merged with the generic lesson from #43 rewritten for the current shell. | Use `PageLayout`; pages bypassing it own their scrolling. |

## Organization matrix and upstream Access

The fork `.env.example` defaults to `VUE_APP_ACCESS_PANEL_ENABLED=true`, matching
the organization deployment. This selects
the fork's `/access` route tree and matrix shell, `/access/grants` landing page,
and grants/audit/service-account navigation. Visibility requires `page:access`;
write controls require `feature:edit_role_mappings`. Roles and per-user overrides
remain part of the matrix overview. The deployment flag enables the feature; it
does not grant a person access.

With the flag false or unset, `/access` selects upstream administration, including
roles, staff, groups, applications, and audit. This preserves compatibility when the
variable is absent in code; the fork example explicitly enables the overlay. Only one of the two `/access`
route trees is registered in a host's build.

The contracts remain separate, but a build selects exactly one authorization authority.
With the organization flag true, the shared access store loads `GET_MatrixMe` for
all panel visibility, route checks and read/write controls; it never consults upstream
grants. `src/configs/organizationAccess.js` translates known UI areas to the same
permissions as the backend route map. Unmapped areas, unavailable permissions and
failed initial loads deny access. Organization read and write grants remain independent, including when backend enforcement is in observe mode.
With the flag false, upstream loading and permission semantics are unchanged.

The backend contracts are:

- Organization matrix: configurable `VUE_APP_ACCESS_API_BASE`, default
  `/api/escaccess/v2`, with `catalog/`, `grants/`, `overrides/`, `users/`,
  `service-accounts/`, and `unassigned/`. `GET_MatrixMe` reads this authority.
- Upstream authorization: `/api/access/v2/me/` and administration under
  `/api/access/v2/admin/`. `GET_Me` serves access loading, route guards and read-only decisions only when
  the organization flag is false.

An upstream Access feature is not evidence that the organization matrix's backend
or per-user override semantics have been replaced. Navigation and route selection
must switch together. Tests exercise both modes and the actual navigation
composables.

## SSO-only behavior on the upstream flow

The shared `useLoginSession().completeLogin()` initializes tokens, profile,
modules, the selected access authority, route checks, and final authentication for SSO as well as
password login. The fork no longer maintains a second manual session setup.

The fork retains `VUE_APP_SSO_ONLY`: password entry and password-change prompts
are hidden, and the login wall starts SSO automatically. A failed attempt blocks
another automatic redirect until deliberate retry; unavailable session storage
also blocks automatic login. The main SSO enablement check interlocks this mode
so a disabled provider cannot leave an unusable login wall.

The callback checks single-use state before exchanging the code, validates that
both tokens were returned, and preserves the successful-login remount regression.
The organization endpoint flags remain supported alongside upstream's
`VUE_APP_SSO_API_BASE`. Both use the backend's flat
`{ access, refresh, customer_id, token_type }` success contract.

Verify the combined release with `claude-gate-run -- scripts/verify-release.sh`: it runs the standard gate, builds an isolated public fixture, and exercises the retained scroll regression with Playwright Chromium. `LAYOUT_DIST` selects that temporary bundle without replacing `dist/`.
