# Changelog

All notable changes to this project will be documented in this file.

## [3.2.0] (2026-10-12)

### Added

- django-access awareness: the CMS loads `GET /api/access/v2/me/` at login and on a cold load (memory only) and
  hides panels and nav entries the user cannot read; a deep link to a refused panel goes to Home with a notice.
  Routes carry `meta.area`, panels `areas` (`docs/panels-routing.md`). Without the access module nothing changes;
  with it installed and `me` failing, area-gated panels stay hidden and Home offers Retry.
- One standard toast for an access-gate 403 (one per burst) and one `me` refresh at most every 5 s.
- A customer (non-staff) account sees "No access to the admin panel" with Log out instead of an empty shell.
- Access managers see a Home warning while the gate is not in `enforce` mode.
- Content create follows `content.pages:write` when django-access is installed.
- Read-only mode: a page the user can read but not write shows no Save, Delete, create, FAB or bulk actions, its
  form fields are disabled and one line says why. Decided once in `PageLayout` from the route's area; `BasicButton`
  and `IconButton` take `mutates` for the other writing buttons. `scripts/audit/readonly.mjs` lists the writing
  buttons the mode does not reach (Pages, PIM, FAQ, Pricing and Forms are clean).
- The PIM product Delete shows only with `pim.product_delete:write`.
- Access panel (munin key `access`, needs `access.manage` read): Roles lists the built-in and custom roles; a role
  page edits a custom role's name, description and permissions, and opens a built-in read-only with Duplicate. A
  custom role never offers `access.manage` (built-in Administrator only). New boot `PermissionMatrix` with a `/ui`
  cell.
- Access → Staff, Groups and Audit: staff accounts with their roles (direct and "via <group>"), grant and revoke a
  role on a staff account or a group, and the access audit log with action, actor and date filters (superuser access
  through the gate grouped per actor and day by default). A revoke refused by the lockout guard reads "At least one
  person must keep access management". Staff accounts and groups are still created in Django admin.
- Access → Applications: machine clients with their state, token count and legacy marker; an application page edits
  its name, description and active state and manages its tokens — New token (scopes in two groups that never mix,
  "reaches browsers" and "server-to-server only", an optional channel pin, an optional expiry — "No expiry" by
  default for every token, no maximum lifetime: D31 replaced the 365-day cap), Rotate (0–168 hours of overlap), Set
  expiry and Revoke (a publishable key warns that storefronts lose it at once). Legacy keys show their source and last
  use and never expire by themselves; Set expiry gives them one. New boot `SecretReveal` shows a new token's value once (Copy, close after "I have stored
  it", the value dropped on close and unmount) with a `/ui` cell.
- Access → Applications: each token row shows its age and, when the API flags `rotation_due`, a "Rotation
  recommended" badge whose tooltip names the catalogue's `token_rotation_days`; the New token dialog says tokens never
  expire unless a date is set and how often to rotate.
- Access strings complete in Polish and English, including a label for each of the 49 catalogue areas and 9 token
  scopes (the role matrix and the token dialog no longer fall back to the catalogue's English); a unit test fails on
  a missing key in either locale.
- `docs/access.md`: the access store and `can()`, areas, the guard, 403 handling, read-only pages, the Access panel
  and the SecretReveal rules.
- e2e `access-users.spec.js` (admin, viewer, editor and customer each see what their roles allow; the gate refuses
  the viewer's own write; three refusals on a page show one toast and refresh permissions once) and
  `access-secret.spec.js` (a new token's value is in no console message, web storage, cookie, URL, page HTML or later
  API response). Visual capture ids for six Access screens (baselines not approved yet).

- AI actions follow the AI toolbox state from one place (`configHealth.aiState` / `aiUsable`): a toolbox switched
  off on purpose (`disabled`) is a calm state, listed as "switched off" in the configuration-health panel with no
  header warning; `disabled` and `unconfigured` turn off Rewrite in Review, Estimate in the translate dialog and an AI
  template's model list and test generate; `unreachable` keeps them on and warns. One shared hint per state
  (`AiToolboxHint`) on Review, the company card and thread, the Communicate dialog, an AI template and the translate
  dialog. A user who cannot read configuration health gets the state from the public module registry
  (`platform.toolbox.state`); against a django-munin without it nothing changes.
- Docs capture project `tests/docs/`: documentation screenshots from the live, seeded stack in English and the dark
  theme at 1280 × 800, as a page or an element crop with optional numbered callouts (`guide`, `goto`, `shot` in
  `tests/docs/support/capture.js`, one spec per guide, `docs/testing.md` § Docs captures). The visual harness exports
  `pinPreferences` and its read-only waits for it; its behaviour is unchanged.
- Docs capture specs for five CMS guides (`sign-in`, `products`, `content-pages`, `blog-posts`, `navigation`):
  23 screenshots, each list shot guarded against rows the seed did not create, every created record deleted again.
- Docs capture specs for five more CMS guides (`attributes`, `categories`, `media`, `duplicates`, `orders`):
  19 screenshots. `duplicates` never confirms a merge; `orders` places one guest order on the storefront per run.
- Docs captures: the `leads` guide (a CSV import to an answered mail, seven shots) and the `translations` guide
  (Translate Store, its estimate and the job list, three shots), with an IMAP append helper for the mail sandbox
  (`docs/testing.md`).

### Security

- With `VUE_APP_DEBUG` on, the API client no longer logs the body of a request flagged `sensitive` or of its response
  (`[redacted]`); every access token call carries the flag, so a created or rotated token's value never reaches the
  console.
- Stored HTML is cleaned where it is rendered: the page builder's rich-text previews and the legal texts of the
  Agreements panel go through `sanitizeHtml` (`src/utils/sanitizeHtml.js`, DOMPurify with the allowlist of the
  rich-text editor), so markup saved through the API cannot run script in a staff session. A unit test fails on a
  `v-html` that skips the helper.
- The session cookies (access and refresh token included) are set with `SameSite=Strict`, and with `Secure` when the
  CMS is served over https.
- A URL from the server (a supplier's product or image page, a meeting link, an enrichment subject, a
  configuration-health fix link, a product video) is bound to `href` only as http, https or mailto (`safeHref`,
  `src/utils/safeHref.js`); every link that opens a new tab carries `rel="noopener noreferrer"`.
- A production build ships no source maps and fails when `VUE_APP_USERNAME` or `VUE_APP_PASSWORD` is set; the login
  wall and the runtime env check read the pair in development only (before, debug mode prefilled it in production
  too). Keep the pair in `.env.development.local`.
- With `VUE_APP_DEBUG` on, the login call is logged as `[redacted]`: neither the password nor the answered token
  pair reaches the console.
- The visual and docs capture projects refuse a `CMS_BASE_URL` or `CMS_API_URL` that is not a loopback host unless
  `CMS_ALLOW_REMOTE=1` is set: they log in with real credentials and the docs captures write (`docs/testing.md`).

### Removed

- The dead role filter of `src/configs/access.js` (`grantAccess`, `routes`, `builderTypes`, the `access` arrays).

### Fixed

- Page titles stay on one line everywhere: a title longer than its row ends with an ellipsis and keeps the full
  text in its `title` attribute, and the chips beside it wrap under it. A long product name used to break inside
  words in a narrow column.
- Access → Audit: with "Group superuser access by day" on, the list shows one row per actor and day for the whole
  log and the pager counts those rows. The rows were folded in the browser, page by page, so a superuser with many
  writes filled every page with one row. The list now asks the API to fold (`fold_bypass`); a folded row loads its
  requests when expanded (the first 50, with a "Showing 50 of N" line). Against an access version without the
  parameter the rows show unfolded.
- Dates and the date picker follow the UI language: order and promotion dates, the page list's "updated" column and
  the calendar's month and weekday names were Polish (or a mix) in the English UI. `formatDate` formats in the
  locale of the UI language (`uiLocale()` in `src/i18n`), no longer in the browser's.

### Changed

- Page builder: the section list reads like the page. A tile card previews its tile (image across the card, title,
  text excerpt) and a few tiles share the section width; sections narrower than `full_width` are inset. A section
  keeps its own zone (type, tile count and uid as a slim bar, its title as a heading, its other content) above the
  tiles tray. Section and tile types show the names of the type picker. A click on a preview opens its editor.
  Tiles are reordered by dragging them in their row, sections by dragging them up and down (the order kit stays);
  "+" between two sections adds a section there, a dashed card at the end of a row adds a tile. A section that
  takes no tiles says so. The tile row is no longer a Swiper.
- Content list: a search box narrows every document list by name (`name=` of the content API).
- Visual harness: `CMS_LANG` (default `PL`) and `CMS_LOCALE` (default `pl-PL`) select the pinned UI language and the
  browser locale; unset, every committed baseline is unchanged. `lang.spec.js` (`@lang`) proves the mode that is set.
- Text fields show focus on the field itself: an accent border and a soft 2 px glow instead of a 2 px outline at a
  2 px offset; the sign-in screen's 8 px halo is gone. Buttons, tabs and links keep the outline.

## [3.1.1] (2026-10-01)

Phone layout fixes (Android report).

### Fixed

- The bottom tab bar no longer disappears under Android's system bar: the app fills the visible viewport (`100dvh`)
  instead of the browser's largest one.
- PIM page headers on a phone keep the title, the channel select and the translate button on one line.
- List toolbars on a phone: the search takes its own row and the filters line up under it.

## [3.1.0] (2026-09-30)

Required features per feature set.

### Upgrade

- Backend: entirius-django-pim >= 3.3.0 for the new behaviour. Against 3.2.x the CMS detects the missing
  `required-features/` endpoint (404, once per session) and keeps the previous behaviour.

### Added

- Feature set edit: per feature an Inherit / Required / Optional control (Inherit shows the feature's own flag),
  saved at once through `PATCH feature-sets/{idx}/features/{feature_idx}/`; disabled for system features.
- Product create: after a feature set is picked, the set's required features (at least `name`) get inputs marked
  required and go out as `attributes`; `REQUIRED_FEATURE_MISSING` / `UNRESOLVED_ATTRIBUTE` answers land on the
  feature's field.
- `usePimCapabilities`: one probe per session decides between the new and the legacy mode.

### Changed

- The product attribute editor marks a feature required by the set's effective flag (`is_required`) before the
  feature's own default.

## [3.0.1] (2026-09-30)

### Fixed

- Section and element config drawer: the Type, Variant and other config selects render and can be picked again, so the rest of the configuration loads. (Redmine #34300)

## [3.0.0] (2026-09-30)

The admin CMS redesigned on the Entirius brand.

### Upgrade

- Backend: django-munin >= 2.2.0 (configuration health), django-communicator >= 0.3.0 and django-leads >= 0.3.0
  (Leads screens) — all in entirius-service-volkanos 3.0.0rc9. Against munin 2.1.0 the health poll 404s quietly.
- Node >= 20.19. Brand tokens come from `@entirius/brand-tokens` 0.1.0 (github.com/entirius/entirius-pwa-brand-tokens).
- Set `VUE_APP_LEADS_CHANNEL` per deployment (default `default-europe`).
- Removed: the legacy components replaced by the unified boots, the old palette and spacing names, `/playground`;
  client `__client` overrides that used them need the new names (`docs/ui-components.md`, `docs/ui-rules.md`).

### Added

- Leads panel for django-leads and django-communicator, mobile first (one thumb at 390 px, two columns from 1024 px):
  Inbox with one row per conversation and All / Drafts / Waiting / Replies filters with counts, one-draft Review
  (Send / Not now in thumb reach, swipe with a button fallback, rewrite with a note, edit, skip company), and a company
  thread as one timeline over every thread of the company, with older threads behind an "Earlier threads" expander.
  Every Leads and Communicator call uses the channel from `VUE_APP_LEADS_CHANNEL` (default `default-europe`), never
  `VUE_APP_CHANNEL` — set it per deployment.
- Leads desktop screens: pipeline board with drag-and-drop between stages, rule badges and type / do-not-contact /
  search filters; company card with Overview, Intel, Contacts and Timeline tabs, Communicate, Re-audit, Mark do not
  contact and Create customer (won leads, with the accounts module); add a single lead by hand; CSV import with the
  batch report. Below 1024 px these screens say "Open on a desktop".
- Leads contacts: add, edit and remove contacts on the company card, with one primary contact per company; a contact
  already used in mail is anonymised instead of deleted.
- Leads Settings: stages and lead types (rename, reorder, deactivate, delete refused inline when in use), mail
  templates (versions, test generate without saving), sequences with a follow-up text pool (edit, remove, restore),
  send policy, channel mode (sandbox mailbox, live gate), an HTML mail footer per language with a sandboxed preview,
  suppressions and waiting mails with Send now. Each section shows only when its backend module is on;
  `/communicator/*` links redirect here.
- Waiting mails state when they go out (an hour, due, daily cap reached, or waiting for the send window) the same way
  on the Inbox, Review, the thread and the waiting table.
- A company linked to a shop customer carries a "Known customer" badge linking to the customer.
- Configuration health (needs django-munin with `health/`): a header warning icon while a check fails, a panel with
  fix links and "Check again", and an inline banner on screens that depend on a failing check (such as the AI toolbox
  or outgoing SMTP).
- Notification bell in the header (django-notifications): unread count polled every 30 s while the tab is visible;
  one tap marks a notification read and opens its subject.
- Optional SSO login: with `VUE_APP_SSO_API_BASE` set the sign-in page offers "Log in with SSO"; unset, nothing
  changes. Contract in `docs/sso-login.md`.
- Input format checks on money, percent, integer, EAN (length and check digit), codes, slugs, email, URL, country and
  currency fields: a wrong value shows under the field when it is left and blocks the save, with an example in the
  message.
- Field hints: a `?` mark after a field label opens its hint on hover, focus or tap; important hints (limits, formats,
  consequences) are filled. The account menu can turn hints off.
- Accessibility baseline: landmarks, a "Skip to content" link, page language from the UI language, focus moved to the
  content after navigation, browser tab titles `<page> · <panel> · Entirius CMS`, visible focus rings on every
  control, reduced motion respected; every dialog traps focus, closes on Esc and returns focus.
- Component catalogue at `/ui` (any signed-in operator): every shared component in both themes from static fixtures.
- UI lint (`npm run lint:ui`, stylelint + eslint): off-token colours, spacing, radii and type sizes, raw controls,
  native `<select>` in views, literal icon names and removed components fail the lint. Rules in `docs/ui-rules.md`.
- Visual fidelity harness (`npm run visual`): token parity, a census that fails on off-token colours, radii and font
  sizes, screen regression with operator-approved baselines, UX guard (off-viewport, click-only, under the bottom bar)
  and axe accessibility checks at desktop and phone sizes. See `docs/testing.md`.
- Dependency on `@entirius/brand-tokens`; Inter and Lexend Deca are self-hosted.

### Changed

- Admin CMS redesign on the Entirius brand: warm-black dark theme and a calmer warm-grey light theme, teal accent,
  Inter for text and Lexend Deca for titles, brand spacing, radius and type scales. Light form-field edges reach 3:1
  contrast on every surface. Google Fonts is no longer requested.
- New app shell: header with user menu (theme, language, field hints), sidebar navigation with collapsible groups
  from 1024 px, a mobile menu and bottom tab bar below it, breadcrumbs and one page title per screen.
- Every panel uses one page frame: title, breadcrumbs and back arrow in the page header, page actions in one action
  bar (on a phone under "Actions"), filters in the toolbar, pagination in the footer. The per-panel toolbars are gone.
- Detail forms across panels follow one pattern: card sections with a two-column field grid, labels, required
  markers and API field errors on each field, Save and Delete in the page header next to the unsaved badge.
- Sign-in, password reset, change password and the SSO callback share one brand frame; errors show under their field,
  the submit button shows progress, a caps-lock hint appears under the password, and Enter submits.
- Home: panel cards in a responsive grid with each panel's icon; locked panels dimmed.
- Buttons: one family with primary, secondary, ghost and danger roles, one primary per page, every delete a danger
  action, icon-only buttons named with a tooltip. Icons are chosen by meaning, one glyph per action across panels.
- Tables: cells never overlap, long text truncates with a tooltip, numbers are right-aligned, empty values show "—",
  secondary columns step back on a phone. Empty lists show one empty state.
- Selects are searchable keyboard comboboxes; a select without a label shows its name as a floating label. Some
  accessible names changed with it (Stock warehouse picker "Warehouse", PIM category status filter "Status").
- Dialogs open as bottom sheets on a phone; menus with longer text open as a panel on desktop and a sheet on a phone.
- Phone layout: every action is reachable, nothing sits under the bottom bar, small controls get thumb-sized hit
  areas, wide tables and tab rows scroll in their own box.
- Pages: the content list groups documents by type with filter chips and a language select; the content editor has
  its actions (Copy, Advanced, Save draft, Save and publish) in the page header and named icon actions per section
  and tile; authors and co-authors are picked by search and reordered by drag.
- Gallery: tag filter chips, sort and page-size selects, a tile grid with edit-tags and delete actions; upload, tag
  manager and tag editor are dialogs.
- PIM products: channel selector, Enabled switch, More actions menu, Delete and Save in the header; translation and
  inherit / override controls next to each field; filters inline on desktop; media in one scrolling row.
- PIM product attributes load their values on demand (first page on focus, more on request, search across all
  values) instead of downloading every value when a product opens.
- PIM taxonomy (categories, features, feature sets, quality rules): detail-form pattern; attribute values are a
  searchable select; inheriting an overridden field asks first.
- One translate dialog for PIM products, PIM store and Pages "Translate all", with an estimate table per language or
  content type.
- Atlas sources and review queue: tabs are keyboard tablists, gallery and raw data open in dialogs, the swipe
  decision bar (Skip, Reject, Approve) pins to the bottom; EAN duplicate groups are tables.
- Enrichment review: filters in a filter panel, one primary action per mode; clicking a row opens Focus on that row.
- Points, Pricing, PriceFighter, Promo, Stock, Agreements, Emails, FAQ, Contact forms, Layout extenders, Orders,
  Customers, Content sets, Translation jobs and Docs: moved to the page frame and detail-form pattern; their tables
  are data tables and their dialogs follow the shared dialog layout.
- PriceFighter: the market cell shows country, currency and channel, so rows that differ only by channel stay apart,
  also on a phone.
- Email configuration tiles open from the keyboard; the nav entry reads "Email configuration".
- Prices table: an unsaved row is marked by a bar on its left edge; the header counts unsaved prices and rows.
- Tax rates are shown and entered in percent ("23 %", "8,5 %") and stored as a fraction.
- Removed for developers: the legacy components (`Dropdown`, `Switcher`, `TextAreaBasic`, `LockedField`, `ToolTip`,
  `BackBar`, `Loading`, the old modal wrappers, the icon font), the old colour palette and spacing names, and
  `/playground` (replaced by `/ui`). The UI lint reports any remaining use.

### Fixed

- Security: the open Dependabot alerts and every `npm audit` finding are closed — TipTap 3.31 (ReDoS in Markdown
  attribute parsing, `mergeAttributes` prototype key), webpack-dev-server 5.2.6 (source exposure, CSRF, HMR socket),
  PostCSS 8.5.26 everywhere (the Vue 2 compiler utils no longer pull PostCSS 7), svgo 2.8.4, fast-uri 3.1.8,
  brace-expansion, joi and qs; `npm audit` reports 0 vulnerabilities.
- Session: the access token refreshes a minute before it expires, whatever lifetime the service issues; a reopened
  tab with an expired token refreshes first; logging out during a refresh no longer signs the user back in.
- The sidebar is no longer empty after a fast click right after sign-in.
- Panels outside `VUE_APP_PANELS` no longer bounce to Home; the module route guard no longer loops when a panel root
  needs a missing module.
- Read-only fields are read-only again (PIM inherited fields, system agreement definitions, Atlas feed and source
  keys).
- Prices and promo minimum order show and send two decimals, a comma reads as a decimal point, and malformed values
  show a field error instead of a server 400; EANs are checked before a PIM save; promo limits no longer stop at 9999;
  text fields carry the API's length limits.
- Number inputs with a fractional step accept decimals ("8,5" no longer becomes 85).
- FAQ items and groups can be deleted and unlinked again; a FAQ answer is required before saving.
- The contact form attachment download button is visible and labelled; the deal value's min and step apply.
- Edit forms show stored values outside the loaded lists (enrichment rules, carrier point types); a missing PIM
  category shows a not-found state instead of a blank form.
- Dates in price history, decision history, gap observations and Atlas events use the CMS date format.
- Stock offers its warehouse picker when no warehouse is active yet; the same CSV file can be picked twice in a row.
- Pages content list opens one delete confirmation, not one per content-type group; its add button checks each
  type's own document limit.
- Gallery keeps the upload dialog and its fields after a failed upload and no longer logs upload payloads.
- Promo: a rule that failed to load cannot be saved over the stored rule.
- Email channel Save cannot be sent twice, and a failed channel load offers a retry.
- Atlas preferred-strategy and evaluation-frequency selects show their value again.
- Layout extender link rows can be dragged in Firefox, and every drag handle also moves its row with Alt+Up / Alt+Down.
- The product translate dialog refuses to send without a picked product (an empty list meant the whole channel).
- Handy-kit category lists load their next page when scrolled to the end.
- On touch screens the styled scrollbar no longer pushes the floating button and toasts off their corner.
- Enrichment spawn rules drop a language a typed channel cannot vouch for.
- Points: a stale page number that comes back empty goes to page 1.

## [2.1.0] (2026-09-01)

### Added

- **Find product: grouped results** (`/atlas/find` and "Find in PIM"): hits split
  into *Exact matches* / *Similar* by the backend's `match` kind (django-lookup
  ≥ 0.2.0; `src/utils/lookupMatch.js` falls back on `similarity` for an older
  backend), `none` neighbours folded behind a disclosure, relevance shown as
  `NN %` with an "Exact" badge, and a photo-specific empty state.

### Security

- **Dependency refresh closing the open Dependabot alerts** (#23, #24, #25): unit-test
  toolchain (vitest 4, happy-dom 20, @vitejs/plugin-vue 6), runtime deps (axios 1.x,
  swiper 14, uuid 11, lodash, sass), and `package.json` `overrides` pinning the patched
  transitive vue-cli 5 / webpack 5 toolchain. Dependabot config added.
- **New CI job `test-e2e-mocked`**: backend-free Playwright smoke of the Atlas panels
  (cookie-stubbed auth, mocked APIs) on every PR.

### Fixed

- **Find product keeps its search across back-navigation**: opening a hit's
  details unmounted the view and wiped results, query and the uploaded photo —
  the operator had to re-upload the picture to inspect a second candidate. The
  last search now lives in the `lookupFind` store and is restored on return.

## [2.0.0] (2026-08-09)

First release from this repository — now the canonical home of the CMS.
The 1.x line was released from the previous internal repository (through
1.6.1); this release restores full feature parity with that line and adds
the changes below.

### Added

- **Multi-method payment rendering** (Checkout orders): `payment_method` is
  rendered as a list — a voucher settling alongside the gateway shows every
  method on the order detail. Orders holding the legacy single dict still
  render.
- **Voucher dormancy without the backend module**: the Promo panel now stays
  available when the backend lacks `checkout_voucher` — Discounts (served by
  `django-checkout`) remain usable, the Vouchers segment hides, voucher
  routes redirect to the panel root via the new `meta.module` route gating,
  and `?tab=vouchers` deep links land on a locked EmptyState.

### Fixed

- **Refresh token no longer clobbered**: when the backend does not rotate
  refresh tokens, the stored token is kept instead of being overwritten with
  `undefined` (users stayed logged in only until the first refresh).
- **Unit suite is self-contained**: `pretest:unit` generates `__client/`, so
  the suite passes in clean environments (CI).

### Changed

- **Documentation refactored to the handbook convention**: compact AGENTS.md
  plus a verified `docs/` reference set (panels/routing, stores/composables,
  UI components, testing, supplier bridges, gotchas, operator guides).
- **Repository identity**: package `entirius-pwa-cms` 2.0.0, MPL-2.0,
  pre-commit secret scanning, GitHub Actions CI.

## [1.6.1] (2026-07-22)

### Added

- **Delivery point type change** (Points panel): the Type dropdown is editable
  for custom points when the backend supports it (django-deliverypoints >=
  1.1.0, detected via the Munin module version — `isModuleAtLeast` in the munin
  store). Carrier points stay locked. Older backends keep the dropdown locked
  so a change is never silently dropped.
- **Order-impact warning on type creation**: creating a new delivery point type
  shows an informative notification that types are stored inside orders and
  cannot be changed or deleted later without developer assistance.

### Fixed

- **Point create no longer rejects empty optional fields**: `buildPayload`
  sent `null` for empty strings, which the create endpoint rejects ("Input
  should be a valid string" on 8 fields). Empty strings are sent as `""`,
  which also makes clearing a field on edit actually persist (PATCH `null`
  means "unchanged" on the backend).
- **No spurious "Unsaved changes" modal after creating a point**: the create
  path now snapshots the form before redirecting, and `useUnsavedChanges`
  recomputes `isDirty` when the snapshot baseline changes (watch covered only
  `current` before, so `snapshot()` after save never reset the dirty flag —
  affects all 9 views using the composable).
- **Translations section hidden on single-language setups** (Point detail):
  nothing to translate into when channels expose one language; the section
  still shows if legacy translations exist.

## [1.6.0] (2026-07-02)

### Fixed

- **Real API error messages reach the operator everywhere** (fixes a regression
  where empty error toasts were shown): the token-refresh interceptor rejects non-401 errors with
  the unwrapped response body, so every view-level `err.response?.data` read
  was dead code and the operator got a generic "Something went wrong" toast
  instead of the backend message. All ~195 ad-hoc handlers across every panel
  (PIM, Points, Faq, Authors, Agreements, Emails, ContactForms, Accounts,
  CheckoutOrders, LayoutExtenders, PriceManager, Promo, Suppliers, Stock,
  Enrichment) now go through `extractApiMessage(err, fallback)`.
- **`useFormErrors` understands every backend error shape**: v2 envelope,
  legacy `{detail}` (string and pydantic list), DRF-in-envelope
  `{meta, data: {field: [msg]}}` and raw DRF `{field: [msg]}` — wrapped and
  unwrapped — with a guaranteed non-empty per-field message.
- **No more empty error UI**: `BasicInput` renders the error line only with a
  non-empty message, `spawnNotification` falls back to a localized message on
  an empty toast (and unwraps refs — `formErrors.summary` passed raw is a
  ComputedRef, always truthy, which silently defeated `||` fallbacks).
- **Promo custom error parsers removed**: `filterErrorMessage`,
  `codeErrorMessage` and the `extractError` helpers now delegate to
  `extractApiMessage`; `handleApiError` re-wrap workarounds dropped.

### Added

- **Promo panel**: full discount/voucher management — discount rules
  with modifiers and per-rule discount codes (`PromoList`/`PromoEdit`),
  campaigns, vouchers (list, detail with code reveal, product vouchers),
  product/threshold/customer filter drawer, and per-channel promo settings.
  Ships a new `promo` + `voucher` API client pair and a `checkoutChannel`
  store; order list gained discount/voucher context.
- **AI translations**: bulk product translation in PIM
  (`TranslateDialog`, `TranslateStoreDialog`), translate-all for content
  (`TranslateAllContentModal` in Builder), and a Translation Dashboard for
  monitoring jobs (`translationJobs` store + `pim`/`contentDB` translator API
  clients). Both the translate actions and the Promo panel are gated on their
  backend modules being enabled (Munin).
- **`Dropdown` field-error support**: new `validate` prop (`{status, msg}`,
  same shape as `BasicInput`) renders an invalid border + message; used for
  the feature-set picker on Product create. `TextAreaBasic` unified to the
  same `{status, msg}` shape.
- **Error-feedback e2e suite** (`tests/e2e/16-error-feedback.spec.js`): live
  required-field and duplicate-SKU scenarios plus six mocked backend error
  shapes (v2, DRF envelope, raw DRF, `{detail}`, 500 HTML, network abort)
  assert the operator always sees a concrete, non-empty message.

## [1.5.2] (2026-06-25)

### Fixed

- **Layout-extender publish persists the draft first**: publishing a
  layout-extender now saves the pending draft before the publish call, so the
  published layout reflects the latest edits instead of the last saved state.
- **Category links now point to real storefront pages**: the category picker
  (`useCategoryFetch`) saves the category `url_key` into `link_value` instead of
  `idx`. Affects every storefront-routing picker -- megamenu items, banners,
  links, and FAQ associations. Previously, categories whose `idx` differed from
  their `url_key` produced catalog links that resolved to zero products. Falls
  back to `idx` when the backend doesn't yet supply `url_key` (requires
  django-pim with the `url_key` field on the admin category list). Internal PIM
  pickers (product-to-category assignment, supplier mapping) keep using `idx`
  and are unaffected.

## [1.1.0] (2026-03-03)

### WYSIWYG Editor Improvements

- **Paste sanitization**: Strip inline `color`, `font-family`, `font-size`, `font-weight`, `background-color`, `line-height`, `letter-spacing` from pasted HTML via `transformPastedHTML`. Toolbar color button still works -- only paste-time styles are removed.
- **Focus mode**: Distraction-free writing via `<Teleport to="body">`. Blurred backdrop, centered card (z-201, above HandyKit), Escape to close, body scroll lock. Expand/compress button in top-right corner of editor (appears on hover, always visible in focus mode).
- **Line-height**: Set to 1.7 for body text, 1.3 for headings, 1.4 for table cells. Applied to both editor and preview.
- **Cursor**: `cursor: text` on `.ProseMirror` in normal mode.
- **Icons**: Registered `faExpand` and `faCompress` in FA icon library.
- **Dark mode cleanup**: Removed `!important` color override from editor (paste sanitization handles it). Kept override in Builder.vue for legacy saved content in read-only previews.

## Earlier development (pre-1.1.0)

### Vue 3 Migration (2026-01-31 to 2026-02-08)

**Major Upgrade**
- Vue 2.6 → Vue 3.5
- Vuex 3 → Vuex 4
- Vue Router 3 → Vue Router 4
- TipTap 2.2 → TipTap 3.19
- Removed compatibility layer - pure Vue 3 implementation

**Architecture**
- Extracted variant matching to reusable composable (`useVariantMatching`)
- Migrated all components to Composition API where beneficial
- Updated component lifecycle hooks (Vue 3 syntax)
- Fixed universal-cookie integration (replaced deprecated vue-cookies)

**UI/UX Improvements**
- Added i18n system with EN/PL locale support
- Collapsible sidebar with material-style polish
- Empty-state placeholders for content list and content sets
- Improved confirmation modal with blur backdrop effect
- Added tile deletion confirmation (previously missing)
- FloatingActions component with proper z-index layering

**Components**
- BasicWysiwyg migrated to TipTap's official `useEditor()` hook
- Updated all global components for Vue 3 compatibility
- Fixed route title resolution for nested routes

**Developer Experience**
- Added comprehensive migration documentation
- Testing infrastructure with Playwright e2e tests
- Debug console helper for development
- Updated build configuration for Vue 3

### Pre-Migration (2026-01-28 to 2026-01-31)

**Gallery Enhancements**
- Gallery tag system implementation
- Tag filtering and management UI
- Bug fixes for image selection and display
- Empty gallery state messaging

**Bug Fixes**
- Fixed configuration loading issues
- Removed debugging artifacts
- General stability improvements

### Feature Development (2025-12 to 2026-01)

**Content Management**
- Document copy functionality
- Delete confirmation for routes and sections
- Vimeo integration (in progress)
- Document configuration options

**UI Components**
- Gallery controller improvements
- Group field controller updates and edition fixes
- Notification system added
- Route list kit enhancements

**Multi-Client Support**
- Multi-client deployment infrastructure
- Client configs moved to gitignore
- Multi-path feature for flexible routing

**Authentication & Security**
- Refresh token expiration handling
- Improved session management

### Core Features (2025 Q3-Q4)

**Builder System**
- Layout extender for custom layouts
- Section creation and management
- Config system with dynamic UI generation
- Vertical scroll improvements

**Content Types**
- Document type dropdown remodel
- Category system improvements
- Gallery integration with content builder

**Developer Tools**
- Config validation and debugging
- Client context improvements
- Build system optimizations

