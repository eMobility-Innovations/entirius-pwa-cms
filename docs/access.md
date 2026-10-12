# Access (django-access)

What the logged-in user may do, how the CMS shows it, and the Access panel. The server is the authority: the
django-access gate refuses every admin call the user's roles do not allow. The CMS only keeps the UI honest — it
hides what would be refused, and handles the refusal when it happens anyway.

Without the access module (munin does not list `access`) none of this applies: every check passes, as before
django-access.

## The store

`useAccessStore` (`src/stores/access.js`) holds `me` from `GET /api/access/v2/me/`:
`{ user, gate_mode, manages_access, roles, permissions: { "<area>": "read" | "write" } }`. Memory only — never a
cookie, web storage or router state.

| When | What |
|---|---|
| Login (`useLoginSession`, after munin) and a cold load (`App.vue`) | `ensureLoaded()` — one request however many callers wait |
| A gate refusal (below) | `refresh()` — at most one `me` call per `REFRESH_INTERVAL_MS` (5 s) |
| Logout (`App.vue`) | `reset()` — an answer that lands after it is dropped |

`status`: `idle` → `loading` → `ready` (`me` loaded) · `absent` (no access module) · `error` (installed, `me` failed).
A failed *refresh* keeps the `me` it had; a failed first load is `error`.

- `can(area, level = "read")` — `write` grants read too. `ready`: from `me.permissions`; `absent`: true; `error`:
  false (never allow-all). Before the first answer it is true for rendering only — the guard awaits `ensureLoaded()`.
- `canAny(areas, level)` — any of them (a panel is visible on read of any of its areas).
- `isStaff` (`me.user.is_staff !== false`), `managesAccess`, `gateMode`, `deniedPanel` (the panel Home names once).

## Areas

An area is a key of the django-access catalogue (`GET /api/access/v2/admin/catalogue/`): 49 areas in 25 modules,
each offering `read`, `write` or both. The CMS uses them in two places:

- **Panels** — `src/configs/access.js` gives each panel its `areas` (the map: `docs/panels-routing.md` § Panel
  Registry). A panel is shown when the user can read any of them; one the user cannot read is hidden, never dimmed.
- **Routes** — a route that works on one area carries `meta.area`; a nav entry takes its route's area and is hidden
  without read on it.

Code never spells an area key: `src/configs/areas.js` holds one constant per key the CMS uses (`AREAS.PIM_PRODUCTS`),
imported by the panel registry, the routes and the in-view checks; `tests/unit/configs/areas.spec.js` keeps each one
in the catalogue snapshot.

Labels: `access.areas.<key>` and `access.scopes.<key>` (the 9 token scopes) in both locales;
`tests/unit/i18n/accessKeys.spec.js` fails on a missing one against the catalogue snapshot
(`tests/fixtures/access-catalogue.json`), and the e2e `access-catalogue.spec.js` diffs the live catalogue against the
snapshot and the labels. A new area or scope in the module needs a line in the snapshot and a label in `en.json` and
`pl.json`; until then the UI shows the catalogue's English
label.

## The guard

`src/router/index.js`, after the munin checks: `canReadRoute` needs read on `meta.area`, else on any area of the
route's panel. A refused panel root (the Home card, the sidebar leaf) opens the panel's first nav entry the user can
read (`accessFallback`); any other refused route goes to `/`, and Home says "You do not have access to …". Routes
without `meta.panel` are untouched.

## Refusals (403)

The gate's body is the v2 envelope `PERMISSION_DENIED` with a detail issue `ACCESS_DENIED`, `STAFF_ONLY` or
`UNMAPPED_ROUTE` (`isAccessRefusal`, `src/api/createClient.js`). On one:

1. one standard toast, "You do not have permission for this action" — one per burst: three refused calls of one page
   show one toast;
2. `access.refresh()` — the user's roles may have changed;
3. the rejection still reaches the view, marked `accessHandled`; the view's own error toast of that request (raised
   in the same task as the rejection) is covered by the standard one — another request's error still shows.

## Non-staff accounts

A customer account (`me.user.is_staff === false`) gets `StaffOnlyWall` (`src/components/Access/`) instead of the
shell: "No access to the admin panel" in the sign-in frame, and Log out. No sidebar, no admin calls. The gate refuses
it anyway (`STAFF_ONLY`).

## Read-only pages

A page whose area the user can read but not write is read-only, decided once in `PageLayout` from the route's area
(`src/composables/useReadonly.js`). It hides Save, Delete, create, the FAB and bulk actions, disables the form fields
(through `FormField`) and shows one notice line (`data-testid="readonly-notice"`). A button that writes outside those
boots takes `mutates`; one whose POST only reads (a lookup, a preview, a validation) declares `:mutates="false"` and
stays. Views never check write permission themselves. Rules: `docs/ui-rules.md` § Page patterns;
`npm run audit:readonly` (in `lint:ui` and the unit suite) fails on a writing button the mode does not reach, in every
panel.

A control outside a `FormField` follows the page too (the FAQ group's "Active" switch, a lead type's switch, the
company card's stage select), and so do the drag lists (stages, FAQ groups, feature sets). A product's prices, stock
and supplier tabs are read-only by their own areas (`pricemanager.prices`, `qms.stock`, `atlas.products`), not by
`pim.products`, and are not shown without read on them. The audit also follows `@update:model-value`, `@change`,
`@end` and `@drop`.

Other in-view gates: Builder's Publish needs `content.publish:write`; the Leads → Settings hub lists only the sections
the user can read; the configuration-health poll runs only with read on `munin.config`. Editing your own grants on the
staff page asks `me` again at once (`refresh(true)`). A deep link opened before login is guarded again after it.

## The Access panel

Munin key `access`; every route needs `access.manage` (built-in Administrator, or a superuser).

| Page | Route | What |
|---|---|---|
| Roles | `/access/roles` | built-in and custom roles |
| Role | `/access/roles/new`, `/access/roles/:key` | name, description, `PermissionMatrix`; a built-in role is read-only with Duplicate (`new?from=<key>`); `access.manage` is never offered to a custom role |
| Staff | `/access/staff`, `/access/staff/:id` | staff accounts, direct grants, roles via groups (read-only); New staff member creates an account with one role, a generated password shown once in SecretReveal |
| Groups | `/access/groups` | a role per group |
| Applications | `/access/applications`, `/access/applications/new`, `/access/applications/:id` | machine clients and their tokens: new, rotate, set expiry, revoke |
| Audit | `/access/audit` | the access audit log, filters by action, actor and date; superuser access folded per actor and day by the API (`fold_bypass`), a folded row loads its requests when expanded |

A revoke the server's lockout guard refuses reads "At least one person must keep access management".

## Token expiry and rotation

No token has to expire and there is no maximum lifetime (D31 replaced the 365-day cap on server-to-server tokens).
New token, Rotate and Set expiry open on "No expiry" for every scope; "On a date" takes any day from tomorrow on. The
client-side checks left: a past day (`EXPIRY_IN_PAST`, also the server's 400 code) and "On a date" with no day picked
(never saved as "No expiry"). The tokens table shows
each token's age (`age_days`: "today", "N days"; a legacy key counts from its import) and a warning "Rotation
recommended" when the API says `rotation_due`; its tooltip and the New token hint name the catalogue's
`token_rotation_days`. Nothing is refused because of age: rotate with overlap, then revoke the old token.

## Token values (SecretReveal)

A new or rotated token's value comes once, in the create or rotate response. The page hands it to `SecretReveal`
(`docs/ui-components.md`) and nowhere else: never a toast, a store, the router, a log. The page calls `show(raw)` on the
boot's ref, so the value never sits in the page's reactive data; Close works only after "I have stored it"; the
field is emptied before the dialog leaves and on unmount; a route leave is refused while it is open. Token API calls
carry `sensitive`, so `VUE_APP_DEBUG` logs `[redacted]` for them. The token list shows `prefix…last_four` only.

## Tests

| Layer | Where |
|---|---|
| Unit | `tests/unit/stores/access.spec.js`, `tests/unit/router/accessGuard.spec.js` + `accessPanel.spec.js`, `tests/unit/components/Access/`, `tests/unit/composables/useNavAccess.spec.js`, `tests/unit/views/Access/`, `tests/unit/boots/PermissionMatrix.spec.js`, `tests/unit/i18n/accessKeys.spec.js`, `tests/unit/configs/areas.spec.js`, `tests/unit/audit/readonly.spec.js` (the read-only audit over every panel's views) |
| e2e, read-only | `tests/e2e/access-users.spec.js` (admin, viewer, editor, customer; the viewer's write refused by the gate; one toast per refusal burst), `access-roles-smoke`, `access-staff-smoke`, `access-applications-smoke`, `access-catalogue` (the live catalogue against the snapshot and both locales' labels) |
| e2e, writes | `tests/e2e/access-secret.spec.js` — creates an application and a secret token, proves the value is in no console message, web storage, cookie, URL, page HTML or later API response; revokes and deactivates in cleanup |
| e2e, writes | `tests/e2e/access-staff-create.spec.js` — `accessadmin` creates `e2e-staff-<run>` (Viewer, generated password shown once), the password signs it in read-only; `manager` sees no Access panel. Each run leaves one account until the next `make seed` |
| Visual | capture ids `access-roles-list`, `access-role-builtin`, `access-staff-list`, `access-audit`, `access-applications-list`, `access-application-detail` (`needsData`: a fresh seed has no application, the row skips) |

The e2e specs need the seeded staff users of the test package (viewer, editor, manager, accessadmin; names and passwords: the test
package's `scripts/seed-access.py` and `docs/configuration.md` § Key settings), overridable as `ACCESS_<KIND>_USERNAME` /
`ACCESS_<KIND>_PASSWORD` (`VIEWER`, `EDITOR`, `MANAGER`, `ADMIN`). The zeno seed gives no non-staff account a Customer row on the channel,
so the real-customer case runs only when the run names one (`ACCESS_CUSTOMER_USERNAME` = its email,
`ACCESS_CUSTOMER_PASSWORD`) and then fails when that login fails on `VUE_APP_CHANNEL`; without it the case skips with
that reason, and the next test proves the wall from a real session whose `me` says non-staff.
