# AGENTS.md

entirius-pwa-cms — admin CMS for the Entirius platform: a Vue 3 SPA with a
visual page builder and 18 self-contained panels (Pages, PIM, Points, Forms,
Accounts, Checkout, Agreements, Emails, FAQ, Pricing, Stock, Translation,
Atlas, Enricher, Promo, PriceFighter, Leads — communicator included, Access), each enabled per backend by the
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

## Commit Message Format

**NEVER add `Co-Authored-By: Claude ...` (or any other Claude/Anthropic attribution) to commit messages.**

This overrides the default Claude Code behavior of appending a `Co-Authored-By` trailer. Commit messages MUST contain only the user's authored content — no robot footer, no "Generated with Claude Code" line, no co-author trailer.

Same rule applies to PR descriptions: no `Generated with [Claude Code]` footer.

## Architecture

```
src/
├── api/          # one client per backend service, built by createClient.js
│                 # (contentDB, pim, munin, suppliers, promo, voucher, orders, …)
├── boots/        # 37 global UI components, registered in register-elems.js
├── composables/  # 12 shared Composition API helpers (useFormErrors, useLoginSession, …)
├── configs/      # access.js — panel registry (idx, icon, root, access areas); builder/ controllers
├── functionals/  # builder UI kit (Handy-kit), Login-wall, Confirmation-modal
├── i18n/         # hand-rolled $t over en.json/pl.json (no vue-i18n, no $tc)
├── router/       # routes + munin and access guard (meta.panel / meta.module / meta.area redirects)
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
| `VUE_APP_USERNAME` / `VUE_APP_PASSWORD` | No | dev auto-login, read in development only (`.env.development.local`); a production build fails with either set |
| `VUE_APP_SSO_API_BASE` | No | path of the backend SSO endpoints; set = "Log in with SSO" button + `/sso/callback` route (`docs/sso-login.md`) |

## Reference Docs

| File | Content |
|---|---|
| `docs/panels-routing.md` | panel registry, route table, munin gating, access control |
| `docs/access.md` | django-access: the access store and `can()`, areas, guard, 403 handling, read-only pages, the Access panel, SecretReveal rules |
| `docs/stores-composables.md` | all Pinia stores and composables, usage patterns |
| `docs/ui-rules.md` | CMS UI rules: tokens, components, layout R1–R9, page patterns, merge checklist |
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

## Leads panel

Salesperson screens for django-leads + django-communicator, mobile first (one thumb at 390 px), desktop =
same screens in two columns (`src/views/Leads/index.vue`, CSS grid only). One panel for both backends (there is no
Communicator panel, UX-002d): munin keys `leads` and `communicator` both map to it, and every nav entry, route and
Settings section carries the module it needs (`requiresModule` / `meta.module` / the hub's filter) — a section of
a module that is off is simply not there. Nav: Inbox · Pipeline (`/leads/board`) · Import (leads) · Settings; a phone gets Inbox · Settings in the bottom bar, which Review
(`meta.noBottomBar`) keeps off its sticky actions. Inbox is one entry for two lists (UX-010): the left column carries a
`SegmentedControl` Conversations | Companies (`leads-list-toggle`, shown with both modules) that only navigates
`/leads/inbox` ↔ `/leads/companies`; a card, draft or thread opened from a list keeps that list in the column, and
the entry stays lit on all of them (`activeOn`). Without communicator there is no Inbox and no toggle: the
Companies entry (`hiddenWithModule: "communicator"`) opens the company list full width. `siteintel` (intel card) and `notifications` (header bell, `src/components/NotificationBar/`)
gate in-view with `isModuleEnabled` — never map them in `MODULE_TO_PANEL`. Every leads-family call takes the
channel from `src/stores/leadsChannel.js` (`VUE_APP_LEADS_CHANNEL`, default `default-europe`), never
`VUE_APP_CHANNEL`. Review has no detail endpoint: the view finds the draft in `review/?status=review_required`.
The thread view opens the newest thread of `leads.Company:<id>` (closed or not); older threads sit behind one "Earlier threads" expander (first `threads/` page, more pages on demand, a row's detail loads with the row so its subject and recipient are readable collapsed) that badges an undecided opt-out; a reply that landed before our newest mail expands that section and opens its thread. A reply that sits in an older thread is marked ("The reply is in this thread") and scrolled into view on arrival (the bell carries only `subject_ref`). A waiting bubble shows no clock of its own: it states `sendState(next_slot)` like the Inbox (`src/utils/leadsTime.js`); a reply's quoted history (from its first `>` line) folds behind a toggle. `/leads/inbox` is one list of every conversation of the channel — one row per `subject_ref` (a company, or any other ref), never one per technical thread (`conversations/`: the newest thread's row, state/draft/waiting/reply from any of its threads, `thread_count > 1` as a quiet "N threads" hint; 20 per page, a 30 s poll like the bell) behind four `FilterChip`s whose counts come with the list (`counts`): All · Drafts · Waiting · Replies — Drafts is the default while drafts wait. A row keeps one layout and one marker (`InboxRow.vue`; the chip decides it for a conversation in several states): a draft opens Review (the row's draft, even from an older thread, "To:" its own recipient), a waiting mail shows a clock + `sendState(next_slot)` and Send now while `canSendNow`, a reply its first own line. Other rows open the company card, and a conversation without a company opens its newest thread at `/leads/conversations/:id`. The bell falls back to that view for an unmapped `subject_ref`. The empty Drafts filter keeps the old empty state ("N scheduled, <state>", `inbox-empty`), and the chip bar is `inbox-summary` — both are the emporium `InboxPage` contract. Activity messages are service strings — `activityText` (`src/utils/leadsLabels.js`) turns the known shapes into sentences. Config problems of the screen
(outgoing SMTP) show as `ConfigBanner code="…"` and the AI toolbox state as `AiToolboxHint` (`src/components/ConfigHealth/`),
both fed by the store `configHealth` — see "Configuration health". `data-testid`s are the contract of the
emporium page objects (`src/entirius_tests/cms_pages/`) — rename both together.

Desktop screens (≥ 1024 px; below that `DesktopOnly.vue` shows "Open on a desktop"): `/leads/board` (stage columns,
drag or the card's stage select → `companies/<id>/transition/`, refused move snaps back; rule badges from
`GET rules/` — the stages payload carries none), `/leads/import` (`POST imports/`, polls the batch).
Settings (`meta.page`: full width, one scroller, no DesktopOnly wall; every section on PageLayout + PageHeader, its tables DataTables):
`/leads/settings` lists the sections, each its own route — `settings/stages` (reorder = `PATCH stages/<id>/ {order}`
per moved stage — there is no bulk order endpoint; delete 409 inline), `settings/templates` (+ `/:id`),
`settings/sequences`, `settings/sending`, `settings/lead-types` (the Stages pattern: rename, reorder by PATCH `order`, deactivate, delete 409 inline; the code is fixed after create); a section leads back to the hub (the PageHeader `back`; a template goes back to the template list). Lead types are one list for the whole panel — `src/stores/leadTypes.js` (loaded once — a failed load is retried, logout resets it in `App.vue` together with the Inbox company-name cache `src/utils/leadsCompanyNames.js` — `label(code)`, `UNKNOWN` built in): Board chips = the active types in order, the company card's type select, the add-lead form and the template Audience (list column + edit select, shown only with the `leads` module; an audience a communicator does not send is never sent back). `/communicator/*` and `/leads/stages`
redirect there; the route names (`CommunicatorTemplates`, `CommunicatorSettings`, `LeadsStages`, …) did not change. `/leads/companies/:id` on desktop is the company card (`Company.vue`, tabs via `?tab=`
overview | intel | contacts | timeline; timeline = the plan-13 thread, which a phone still gets alone);
notification jumps open `?tab=timeline`.
The Contacts tab (`tabs/ContactsTab.vue`, UX-011) adds, edits and removes contacts — one form at a time, above the
contacts DataTable — with the primary star (one per company, server-side); the fields are `ContactFields.vue`, shared with the add-lead form. Remove
answers 204 (never used, deleted) or 200 (used, anonymised) and the status line says which; anonymised rows are history only.

### Communicator sections of Settings

Template edit sends `auto_approve` back unchanged (Grappelli-only), test-generate
never saves. `GET templates/` is unpaginated (every template of the channel in `results`) and takes no `is_active`
filter, so the Communicate modal filters the full list client-side. Settings: mail footer per language (`SettingsFooter.vue`: HTML around `{{ legal }}` — the agreements text at send time; the server sanitises on save and answers with the cleaned HTML, which goes back into the field; languages = footers + template languages; preview in an empty-sandbox `<iframe srcdoc>` with a sample legal text; no footer = the legal text alone), send policy (holiday country is set
per channel — the SendPolicy API has no country field, so it is read-only here), channel mode (`PATCH channel/` never carries `live_enabled`; sandbox needs a
mailbox, C-30), suppressions, waiting messages (`approved` + `scheduled`) with Send now =
`messages/<id>/send-now/` (moves `scheduled_at` only, C-31; a mail already at the channel clock cannot be pulled
any earlier, so it offers no second Send now — a reload keeps that). The departure column is a state, never a
clock that slides: `sendState` (`src/utils/leadsTime.js`) names an hour only for a `next_slot` in the future,
else it says due / daily cap reached / waiting for the window with its hours; a used-up cap wins over any slot and
a closed window (policy `windows`, channel time zone) never shows a clock. `next_slot` (outbox endpoint, `GET_WaitingMessages`)
is the one slot the Inbox rows, the Review confirmation (looked up after accept), the thread bubbles and this table all read, so no two screens disagree. The waiting table (DataTable, the recipient under the company) keeps Send now inside the card at 1280 px with the sidebar open; `scheduled-row` + `data-message` sit on the row through DataTable `rowAttrs`. Sequences: create (no step edit API) + the text pool: add, edit in place through the row's edit square (future follow-ups only), remove — a text a thread already got is deactivated, not deleted (DELETE answers 200 with the row instead of 204), listed dimmed with Restore (`TextPool.vue`).

## Configuration health

`src/stores/configHealth.js` polls munin `GET health/` (admin-only, 30 s, like the bell) while `munin.loaded`, the
`munin` module is on and the user can read `munin.config` (django-access); "Check again" = `POST health/check/` (adds the live probes). State, not events: nothing is
marked read, a fixed config clears on the next poll. The header triangle (`ConfigHealthButton.vue`, next to the bell)
exists only while a check fails — plus ~10 s of green "fixed" after a bad → good flip; the user menu always opens the
panel (green grid on demand). Text lives once in `config_health.checks.<code with _>.<state>` (`{scope}` = channel),
read by panel and `ConfigBanner`; an unknown code falls back to the backend `title`. `fix_url` starting with `/` is a
router link, anything else opens in a new tab. Probe failures (rows with `probe: true`, from "Check again") stay
until the next "Check again" — a plain poll never repeats a probe. Needs django-munin with `health/` (the release
after 2.1.0): against 2.1.0 the poll 404s quietly. The new munin still sends the deprecated
`platform.toolbox_status` (removed in 3.0.0), so an older CMS keeps working against it.

A row in state `disabled` (the AI toolbox switched off on purpose) is healthy and visible: it sits in the passing
list as "switched off", never shows the header icon, never counts and never flashes "fixed" (`QUIET_STATES`).

AI actions follow one value, `configHealth.aiState`: the `toolbox.status` health row first; without one (health is
read only with `munin.config`, or it is unavailable) the public registry's `platform.toolbox.state`, which
`munin.fetchModules` keeps in `munin.platform`; `""` when neither reports it (an older munin). `aiUsable` is false
for `disabled` and `unconfigured`: Review's Rewrite, the translate dialog's Estimate, and an AI template's model list
and test generate are off; `unreachable` leaves them on, since the toolbox may answer again. `AiToolboxHint` (no
props) is the one place for the hint, with one text per state in `config_health.checks.toolbox_status.<state>`:
Review, the company card and thread, the Communicate dialog, an AI template and the translate dialog. A new AI
action reads `aiUsable` and renders the hint, never its own state check or text.
