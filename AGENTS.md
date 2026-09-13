# AGENTS.md

entirius-pwa-cms — admin CMS for the Entirius platform: a Vue 3 SPA with a
visual page builder and 16 self-contained panels (Pages, PIM, Points, Forms,
Accounts, Checkout, Agreements, Emails, FAQ, Pricing, Stock, Translation,
Atlas, Enricher, Promo, PriceFighter), each enabled per backend by the
django-munin module registry. Backend for local dev: entirius-zeno at `http://localhost:8100`.

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

## Commit Message Format

**NEVER add `Co-Authored-By: Claude ...` (or any other Claude/Anthropic attribution) to commit messages.**

This overrides the default Claude Code behavior of appending a `Co-Authored-By` trailer. Commit messages MUST contain only the user's authored content — no robot footer, no "Generated with Claude Code" line, no co-author trailer.

Same rule applies to PR descriptions: no `Generated with [Claude Code]` footer.

## Architecture

```
src/
├── api/          # one client per backend service, built by createClient.js
│                 # (contentDB, pim, munin, suppliers, promo, voucher, orders, …)
├── boots/        # 39 global UI components, registered in register-elems.js
├── composables/  # 12 shared Composition API helpers (useFormErrors, useLoginSession, …)
├── configs/      # access.js — panel registry (idx, icon, root); builder/ controllers
├── functionals/  # builder UI kit (Handy-kit), Login-wall, Confirmation-modal
├── i18n/         # hand-rolled $t over en.json/pl.json (no vue-i18n, no $tc)
├── router/       # routes + munin guard (meta.panel / meta.module redirects)
├── stores/       # 11 Pinia stores (munin, user, notify, per-panel channels, …)
└── views/        # route components, one directory per panel
__client/         # per-deploy JSON configs, generated — never commit
__client_default/ # committed config skeletons copied by scripts/init-client.js
tests/            # unit/ (Vitest) + e2e/ (Playwright) + helpers/
```

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `VUE_APP_API_URL` | Yes | backend base URL |
| `VUE_APP_CHANNEL` | Yes | active sales channel |
| `VUE_APP_PANELS` | No | fallback panel ids when the Munin API is unavailable |
| `VUE_APP_MODULES` | No | fallback module keys (same role as `VUE_APP_PANELS`) |
| `VUE_APP_HIDE_DISABLED_PANELS` | No | `TRUE` hides locked panels instead of graying them |
| `VUE_APP_CLIENT` | No | alternate `__client/` config directory |
| `VUE_APP_LANG` | No | UI language (`EN`/`PL`) |
| `VUE_APP_DEBUG` | No | debug logging |
| `VUE_APP_USERNAME` / `VUE_APP_PASSWORD` | No | dev auto-login |
| `VUE_APP_SSO_API_BASE` | No | path of the backend SSO endpoints; set = "Log in with SSO" button + `/sso/callback` route (`docs/sso-login.md`) |

## Reference Docs

| File | Content |
|---|---|
| `docs/panels-routing.md` | panel registry, route table, munin gating, access control |
| `docs/stores-composables.md` | all Pinia stores and composables, usage patterns |
| `docs/ui-components.md` | boot components, DataTable API, directives, theming, RWD |
| `docs/config-system.md` | `__client/` file map, variant system, env validation |
| `docs/supplier-bridges.md` | PIM ↔ Suppliers integration patterns and dashboards |
| `docs/testing.md` | test commands, suite table, writing unit/e2e tests |
| `docs/sso-login.md` | optional SSO login: backend endpoint contract, callback flow, state handling |
| `docs/gotchas.md` | repo-specific traps (read before touching configs/i18n/panels) |
| `docs/navigation-editor.md` | operator guide: navigation editor |
| `docs/rich-content-building.md` | operator guide: rich content building |

## Product Lookup ("Find product")

`/atlas/find` (nav: Atlas → Find product) is a single-box search — type an
EAN/name/MPN or drop/paste/pick a product photo — that calls the
`django-lookup` module's admin `search`/`check` API and shows ranked PIM +
atlas candidates with match reasons, grouped by the hit's `match` kind —
*Exact matches* / *Similar*, `none` neighbours folded behind a disclosure
(`src/utils/lookupMatch.js`, with a `similarity` fallback for a backend
without `match`). Route + nav entry are gated on the
optional `lookup` backend module (`meta.module` / `requiresModule`, munin key
`lookup`). Client code: `src/api/lookup/`, `src/components/lookup/`
(`DedupSearchBox`, `CandidateRow`), `src/utils/imageDownscale.js` (client-side
JPEG downscale, image never leaves the browser un-downscaled),
`src/utils/resolveMediaUrl.js` (relative `/media/...` thumbnails need the API
origin prefixed), `src/views/Atlas/Find.vue` (the last search — results,
query, photo blob — survives back-navigation via `src/stores/lookupFind.js`:
opening a hit leaves the atlas subtree and unmounts the view). The same box
is reused inline
per SourceProduct in `ProductsTab.vue`'s detail drawer ("Find in PIM" →
`src/views/Atlas/components/FindInPimPanel.vue`, seeded from that row's
name/ean/image). Its "Link" action posts to atlas
`products/<pk>/link-to-realproduct/`, which attaches the SourceProduct itself
(`real_product` + `SourceProductLink` in one transaction) — a bare
product-links create would leave the row unmatched and re-proposed.
