# Panels and Routing

18 self-contained panels, each gated by a django-munin backend module. Panel
metadata lives in `src/configs/access.js`; route gating lives in
`src/router/index.js` and `src/stores/munin.js`.

## Panel Registry

`src/configs/access.js` exports `panels`. Each entry:
`{ name, idx, icon, root, fallback?, labelKey, descriptionKey, areas }`. `icon`
is a Font Awesome icon name rendered via `FontAwesomeIcon`; `areas` are the
django-access areas the panel works on (catalogue keys such as
`pim.products`) — the panel is shown when the user can read any of them. The
first area is the read-only default of a route without `meta.area`
(`routeArea`, `src/composables/useReadonly.js`).

| idx | Name | Root | Icon | Areas |
|---|---|---|---|---|
| `pages` | Pages | `/pages/content` | `file-code` | `content.pages`, `content.publish`, `content.media`, `content.schema` |
| `pim` | PIM | `/pim/products` | `boxes-stacked` | `pim.products`, `pim.categories`, `pim.schema`, `pim.quality`, `suppliers.sources`, `suppliers.products` |
| `points` | Points | `/points/list` | `location-dot` | `deliverypoints.points` |
| `forms` | Forms | `/forms/list` | `envelope` | `contact_forms.submissions`, `contact_forms.leads`, `contact_forms.settings` |
| `accounts` | Accounts | `/accounts/customers` | `users` | `accounts.customers` |
| `checkout` | Orders | `/checkout-orders/orders` | `shopping-cart` | `checkout.orders` |
| `agreements` | Agreements | `/agreements/list` | `file-contract` | `agreements.definitions`, `agreements.consents` |
| `emails` | Emails | `/emails` | `at` | `email.templates` |
| `faq` | FAQ | `/faq/groups` | `circle-question` | `faq.faq` |
| `pricing` | Pricing | `/pricing/prices` | `money-bill-wave` | `pricemanager.prices`, `pricemanager.settings` |
| `stock` | Stock | `/stock/manage` | `warehouse` | `qms.stock` |
| `translation` | Translation | `/translation-jobs` | `language` | `pim_translator.translate`, `contentdb_translator.translate` |
| `atlas` | Atlas | `/atlas/list` | `globe` | `atlas.sources`, `atlas.products`, `atlas.credentials`, `lookup.search` |
| `pricefighter` | PriceFighter | `/pricefighter/gap` | `scale-balanced` | `pricefighter.decisions`, `pricefighter.rules` |
| `enricher` | Enricher | `/enrichment` | `wand-magic-sparkles` | `enrichment.rules`, `enrichment.proposals` |
| `promo` | Promo | `/promo/list` | `tags` | `checkout.discounts` |
| `leads` | Leads | `/leads/inbox` (fallback `/leads/companies`) | `inbox` | `leads.companies`, `leads.settings`, `leads.gdpr`, `communicator.review`, `communicator.content`, `communicator.conversations`, `communicator.settings`, `siteintel.audits` |
| `access` | Access | `/access/roles` | `user-shield` | `access.manage` |

This array is static metadata only. Whether a panel is *usable* is decided at
runtime by `useMuninStore().isPanelEnabled(idx)` (the module is on) and
`useAccessStore().canAny(panel.areas)` (the user may read it).

## Route Table

Every route belongs to a panel via `meta.panel`. Routes are namespaced by
path prefix and lazy-loaded (`() => import(...)`). Grouped by panel:

| Path prefix | Views |
|---|---|
| `/` | Home (panel selector cards) |
| `/pages/...`, `/gallery`, `/content-sets`, `/doc`, `/content`, `/layout-extender` | Builder, Gallery, ContentSets, Docs, Authors, LayoutExtenders/NavigationEditor (legacy paths redirect into `/pages/...`) |
| `/pim/...` | ProductList/Create/Detail, CategoryList/Create/Detail, FeatureSetList/Edit, FeatureList/Edit, GapDefinitionList/Edit |
| `/points/...` | PointList, PointEdit, TypeList |
| `/forms/...` | ContactFormList/Detail, BookingList/Detail, LeadList/Detail |
| `/agreements/...` | AgreementList/Edit, ConsentPeople, ConsentPersonDetail |
| `/accounts/...` | CustomerList, CustomerDetail |
| `/checkout-orders/...` | OrderList, OrderDetail |
| `/emails/...` | EmailsDashboard, EmailChannelEdit, EmailLangConfigEdit, EmailTemplateList/Edit |
| `/faq/...` | GroupList/Edit, ItemList/Edit, DuplicateReport (`duplicates`) |
| `/pricing/...` | PriceList/Detail, TaxClassList/Detail, ChannelList/Detail |
| `/stock/...` | WarehouseStockTable |
| `/translation-jobs` | TranslationDashboard |
| `/access/...` | RoleList, RoleDetail (`roles/new`, `roles/:key`; a built-in role opens read-only, Duplicate = `roles/new?from=<key>`); StaffList (`staff`), StaffDetail (`staff/:id` — direct grants, group roles read-only), GroupList (`groups`), ApplicationList (`applications`), ApplicationDetail (`applications/new`, `applications/:id` — tokens: new, rotate, set expiry, revoke; the raw value only in `SecretReveal`), AuditList (`audit`) |
| `/atlas/...`, `/suppliers/*` + `/supplier-review` (legacy redirects) | SupplierList/Detail, AutoMatched, Duplicates, SupplierReview (Review/) |
| `/pricefighter/...` | GapTable, Strategies, DecisionHistory |
| `/enrichment/...` | Review: EnrichmentReview (Proposals) and RunsPage (`runs`, `runs?task=<id>` = one run, its proposals in place) as tabs (`RouteTabs`); EnrichmentStudio RunList + RunView (`studio`, `studio/:uid?step=`); Settings (`settings/…`): Profile, Memory, EnrichmentTemplates List/Edit, EnrichmentSpawnRules List/Edit as tabs; the old `tasks`, `profile`, `memory`, `templates/…`, `spawn-rules/…` paths redirect with their query |
| `/promo/...` | PromoList/Edit, VoucherDetail |
| `/leads/...`, `/communicator/*` + `/leads/stages` (legacy redirects) | Inbox, Companies, Company, Review, Thread, Board, Import, Settings and its sections (communicator templates, sequences, sending, stages, lead types); every screen on PageLayout + PageHeader and the boots, with no panel stylesheet of its own |
| `/change-password`, `/password-reset` | ChangePassword (authenticated), PasswordReset (unauthenticated, from email link) |
| `/sso/callback` | SsoCallback (unauthenticated, return leg of the optional SSO login; `docs/sso-login.md`) |

Details for every child route are in `src/router/index.js` — this table maps
prefixes to view components, not individual paths.

FAQ → Duplicate questions (`/faq/duplicates`) lists every question shown more than once in `VUE_APP_CHANNEL`: active
FAQ items (and their translations) and the `faq_items` lists of contentdb drafts of every content type, so a repeat
shows before it is published. A section counts by its data (`faq_items: [{ question, answer }]`), not by its type
name, which each deployment configures in `__client/`. Questions match after `normalizeQuestion`
(`src/utils/faqDuplicates.js`: no tags, case, punctuation or diacritics); similar wording is not matched. Both APIs
scope by channel the way the storefront does (`src/views/Faq/duplicateSources.js`). Without the `contentdb` module
or read on `content.pages` and `content.schema` the report compares FAQ items only. It reads, never writes: a repeat is fixed in the
item or the page it links to.

Studio "Open draft" builds a Builder route with the content type `blog-post` (`DOCUMENT_TYPE` in
`src/views/EnrichmentStudio/studioLogic.js`), a copy of the backend setting `CONTENTDB_ENRICHMENT_DOCUMENT_TYPE`. A
service that changes that setting opens the wrong Builder route until the run API carries its draft's content type.

## Gating Model

### `meta.panel` — panel-level gate

The router's `beforeEach` guard (`src/router/index.js`) reads `to.meta.panel`.
If set, and the user is authenticated but Munin data has not loaded yet, the
guard awaits `munin.ensureLoaded()` before deciding. If
`munin.isPanelEnabled(panel)` is false, the guard redirects to `/`.

`isPanelEnabled` (in `useMuninStore`, `src/stores/munin.js`) checks a
`Set` computed from three sources, in priority order:

1. **Munin API** — for each module Munin reports, `MODULE_TO_PANEL[mod.key]`
   maps it to one or more panel idx values. A module maps to a panel only if
   `mod.enabled_in_cms` is true. A module key can map to an array of panels
   (OR semantics): e.g. `checkout` maps to both `checkout` and `promo`, so
   the Promo panel stays visible even when only Vouchers is disabled.
2. **`VUE_APP_PANELS` gap-filler** — a comma-separated env var. It force-enables
   a panel only if Munin does **not report that panel at all** (module not yet
   registered with Munin, e.g. `enricher`). It never overrides an explicit
   admin "off" for a module Munin does report.
3. **Pre-login** — before Munin data loads, `enabledPanels` is exactly the
   `VUE_APP_PANELS` set.

### `meta.module` — module-level gate (in-panel feature)

A route can require an optional module beyond its panel. Example:
`/promo/voucher/:pk` (`VoucherDetail`) sets `meta.module: "checkout_voucher"`
because the view calls `/api/checkout-voucher/*` on mount — it must not
resolve even when the `promo` panel itself is enabled via `checkout`. If
`munin.isModuleEnabled(module)` is false, the guard redirects to the panel's
`root` (from the registry), not to `/`.

### `meta.area` — the user's permission (django-access)

The whole access picture — store, refusals, read-only pages, the Access panel, token values — is
`docs/access.md`; this section is the routing part.

`useAccessStore` (`src/stores/access.js`) holds the user's `me` from
`GET /api/access/v2/me/`, loaded at login (after munin) and on a cold load,
in memory only. A route that belongs to one area carries `meta.area` (the
catalogue key, e.g. `pim.categories`); after the munin checks the guard needs
read on it — or, on a route without `meta.area`, read on any of its panel's
`areas`. A refused panel root (the Home card, the sidebar leaf) opens the
panel's first nav entry the user can read; any other refused route goes to
`/`, and Home names the panel ("You do not have access to …", a different
notice from a module that is off). Routes without `meta.panel` are untouched.

- **Without the access module** (munin does not list `access`) every check
  passes — the behaviour before django-access.
- **Installed but `me` failed** (network, 5xx): every area-gated panel is
  hidden and Home shows "Could not load your permissions" with Retry. Never
  allow-all. A failed *refresh* keeps the `me` it had.
- **Nav:** a panel the user cannot read is always hidden (never dimmed like a
  module that is off); a nav entry takes its route's `meta.area` and is
  hidden without read on it.
- **403 from the gate** (`PERMISSION_DENIED` with issue `ACCESS_DENIED`,
  `STAFF_ONLY` or `UNMAPPED_ROUTE`): `createClient` shows one standard toast
  per burst, refreshes `me` (at most once per 5 s) and still rejects to the
  view, the body marked `accessHandled`; the view's own toast for it is
  covered by the standard one (`extractApiMessage` returns the same text; any
  negative toast in the first second after it is dropped too).
- **Non-staff account** (`me.user.is_staff === false`): App shows a full-screen
  notice in the `AuthLayout` frame with Log out instead of the shell.
- **Access managers** (`me.manages_access`) see a Home warning while
  `me.gate_mode` is not `enforce`.
- **Read-only mode:** a page whose area the user can read but not write
  shows no Save, Delete, create, FAB or bulk action, disabled fields and one
  notice line; decided once in `PageLayout` (`src/composables/useReadonly.js`,
  `docs/ui-rules.md` § Page patterns). The PIM product Delete needs
  `pim.product_delete:write` (an Editor edits without it).
- Content create (`Builder/Builds.vue` `canCreate`) is
  `can("content.pages", "write")` while the module is there, else the contentdb
  content permissions.

The server is the authority; these checks only keep the UI honest.

### `VUE_APP_HIDE_DISABLED_PANELS`

Controls how locked panels render in the UI (not routing — the guard always
blocks disabled panels regardless of this flag):

- **Unset / not `"TRUE"`** (default) — locked panels render grayed out with a
  lock icon (`Home/index.vue` panel cards, the sidebar and the mobile menu),
  non-interactive.
- **`"TRUE"`** — locked panels are filtered out of the list entirely; only
  enabled panels appear.

`panelList()` / `usePanels()` (`src/composables/useNav.js`) implement it once:
the registry mapped through `munin.isPanelEnabled`, then filtered by the flag
(and by `access.canAny(panel.areas)`).

## Navigation model

One model feeds every region of the shell (`src/composables/useNav.js`):

- **Panels** — `usePanels()`: the registry in order × Munin × the hide flag.
  Home, the sidebar and the mobile menu read it.
- **Entries** — `src/components/Navigation/nav-routes.js` lists every sub-page
  (`buildNavRoutes()`: route, label, icon, `app: [panelIdx]`, the
  `requiresQuality` / `requiresModule` / `hiddenWithModule` / `desktopOnly`
  filters, `activeOn` prefixes). `navTree()` groups them per panel
  (`filterNavRoutes(routes, { panel, … })`). A panel with more than one entry is
  a disclosure group in the sidebar, a panel with one entry is a leaf link.
- **Where the user is** — `useActiveNav()`: the panel is `route.meta.panel`
  (`home` on `/`); the lit entry is `resolveNavEntry()`: exact path →
  `activeOn` → `meta.navParent` → the longest entry prefix. A detail or create
  page whose path does not nest under its list declares `meta.navParent: "<entry
  route>"` (points, forms, agreements, atlas and promo details / creates).
- **Route tabs** — a screen whose sections are routes of their own (Enricher
  Review: Proposals | Runs; Enricher Settings: profile, memory, templates, spawn
  rules) has one entry (it lights by path prefix) and shows the sections as
  `RouteTabs` in its `PageHeader` `tabs` slot (the tab sets live in `nav-routes.js`; a tab
  whose route's area the user cannot read is left out). Each tabbed page passes
  `:crumbs="[]"` and wraps its body in `routeTabPanel(<tabs>, <its route name>)`.
- **Breadcrumbs** — `useBreadcrumbs()`: panel → entry → the `meta.crumbParent`
  chain (route names; the email and communicator template editors, the Enricher
  template and spawn-rule editors) → the page.
  None on a panel's list itself (R3). The shell's page header
  (`src/components/Shell/ShellPageHeader.vue`) provides them to the view's
  `PageHeader` with a back action to the parent crumb, and renders a fallback
  header (crumbs + H1 from `titleKey`) on a route whose view has no PageHeader.
- **Breakpoint** — the shell switches at `SHELL_BREAKPOINT` (1024 px,
  `src/utils/breakpoints.js` = `$breakpoint-shell`, `useIsDesktop`): the sidebar
  from there up, the header menu button, `MobileMenu` and `BottomTabBar` below.
  `desktopOnly` entries follow the same number.

To add a page: its route (`meta.panel`, `meta.titleKey`, `meta.area` when it
belongs to one area, `navParent` when its path does not nest under the list),
and an entry in `nav-routes.js` if the sidebar should list it.
