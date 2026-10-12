# AGENTS.md

`entirius-pwa-cms` — the admin CMS of Entirius: a Vue 3 SPA with a visual page builder and self-contained panels
(Pages, PIM, Points, Forms, Accounts, Checkout, Agreements, Emails, FAQ, Pricing, Stock, Translation, Atlas,
Enricher, Promo, PriceFighter, Leads — communicator included, Access), each enabled per backend by the django-munin
module registry.

## Commands

| Command | Meaning |
|---|---|
| `npm ci` | install dependencies |
| `npm run serve` | dev server on :8080 (generates `__client/` from `__client_default/`) |
| `npm run build` | production build (generates `__client/`) |
| `npm run test:unit` | Vitest component/unit suite (generates `__client/`) |
| `npm test` | build check + full Playwright e2e (needs a running backend) |
| `npm run test:smoke` | quick e2e sanity (~2 min) |
| `npm run pretty` | Prettier over `*.vue` |
| `npm run lint:ui` | UI lint (stylelint + eslint + the P2 scale codemod `--check` + `audit:readonly`), warnings = debt, old token names fail |
| `npm run audit:readonly` | fails on a write control the read-only mode does not reach (`scripts/audit/readonly.mjs`; mark it `mutates`, or `:mutates="false"` for a POST that only reads) |

## Conventions

- English only: code, comments, docs, commits, branches, PRs.
- MPL-2.0.
- Git flow: `master` (production) + `develop` (integration); feature branches
  land in `develop` via squash PR; tags live on `master`.
- `munin` is the django-munin API contract (module discovery + panel
  enablement). Never rename the client (`src/api/munin/`), the store, or the
  endpoints — it is a public API contract with the backend.
- Optional backend modules must degrade to dormant UI, never break it: panels
  gate via route `meta.panel` + `MODULE_TO_PANEL` (`src/stores/munin.js`);
  routes needing an optional module declare `meta.module`; in-view features
  use `isModuleEnabled` / `isModuleInstalled` / `isModuleAtLeast`.
- UI: `docs/ui-rules.md` is the only CMS UI rule file; change it in the PR that
  changes the code it describes.

### Commit Message Format

**NEVER add `Co-Authored-By: Claude ...` (or any other Claude/Anthropic attribution) to commit messages.**

This overrides the default Claude Code behavior of appending a `Co-Authored-By` trailer. Commit messages MUST contain only the user's authored content — no robot footer, no "Generated with Claude Code" line, no co-author trailer.

Same rule applies to PR descriptions: no `Generated with [Claude Code]` footer.

## Architecture

```
src/
├── api/          # one client per backend service, built by createClient.js
│                 # (contentDB, pim, munin, atlas, promo, voucher, orders, …)
├── boots/        # global UI components, registered in register-elems.js
├── composables/  # shared Composition API helpers (useFormErrors, useLoginSession, …)
├── configs/      # access.js — panel registry (idx, icon, root, access areas); builder/ controllers
├── functionals/  # builder UI kit (Handy-kit), Login-wall, Confirmation-modal
├── i18n/         # hand-rolled $t over en.json/pl.json (no vue-i18n, no $tc)
├── router/       # routes + munin and access guard (meta.panel / meta.module / meta.area redirects)
├── stores/       # Pinia stores (munin, user, notify, per-panel channels, …)
└── views/        # route components, one directory per panel
__client/         # per-deploy JSON configs, generated — never commit
__client_default/ # committed config skeletons copied by scripts/init-client.js
tests/            # unit/ (Vitest) + e2e/ (Playwright) + helpers/
```

| Topic | Where |
|---|---|
| panel registry, route table, munin gating, access control | `docs/panels-routing.md` |
| django-access: the access store and `can()`, areas, guard, 403 handling, read-only pages, the Access panel, SecretReveal rules | `docs/access.md` |
| all Pinia stores and composables, usage patterns | `docs/stores-composables.md` |
| CMS UI rules: tokens, components, layout R1–R9, page patterns, merge checklist | `docs/ui-rules.md` |
| boot components, DataTable API, directives, theming, RWD | `docs/ui-components.md` |
| `__client/` file map, variant system, env validation | `docs/config-system.md` |
| PIM ↔ Suppliers integration patterns and dashboards | `docs/supplier-bridges.md` |
| test commands, suite table, writing unit/e2e tests | `docs/testing.md` |
| optional SSO login: backend endpoint contract, callback flow, state handling | `docs/sso-login.md` |
| repo-specific traps (read before touching configs/i18n/panels) | `docs/gotchas.md` |
| operator guide: navigation editor | `docs/navigation-editor.md` |
| operator guide: rich content building | `docs/rich-content-building.md` |
| Environment files, variables reference, deployment modes | `docs/deployment.md` |
| Product lookup ("Find product"): route, gating, client code | `docs/product-lookup.md` |
| Leads panel: inbox, board, settings, communicator sections | `docs/leads-panel.md` |
| Configuration health: the store, the header icon, AI action state | `docs/config-health.md` |

## Settings

| Variable | Required | Purpose |
|---|---|---|
| `VUE_APP_API_URL` | Yes | backend base URL |
| `VUE_APP_CHANNEL` | Yes | active sales channel |
| `VUE_APP_LEADS_CHANNEL` | No | channel of every leads-family call (default `default-europe`), never `VUE_APP_CHANNEL` |
| `VUE_APP_PANELS` | No | fallback panel ids when the Munin API is unavailable |
| `VUE_APP_MODULES` | No | fallback module keys (same role as `VUE_APP_PANELS`) |
| `VUE_APP_HIDE_DISABLED_PANELS` | No | `TRUE` hides locked panels instead of graying them |
| `VUE_APP_CLIENT` | No | alternate `__client/` config directory |
| `VUE_APP_LANG` | No | UI language (`EN`/`PL`) |
| `VUE_APP_DEBUG` | No | debug logging |
| `VUE_APP_USERNAME` / `VUE_APP_PASSWORD` | No | dev auto-login, read in development only (`.env.development.local`); a production build fails with either set |
| `VUE_APP_SSO_API_BASE` | No | path of the backend SSO endpoints; set = "Log in with SSO" button + `/sso/callback` route (`docs/sso-login.md`) |
