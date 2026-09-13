# Panels and Routing

16 self-contained panels, each gated by a django-munin backend module. Panel
metadata lives in `src/configs/access.js`; route gating lives in
`src/router/index.js` and `src/stores/munin.js`.

## Panel Registry

`src/configs/access.js` exports `panels` (the `apps` array). Each entry:
`{ name, idx, icon, root, labelKey, descriptionKey, access }`. `icon` is a
Font Awesome icon name rendered via `FontAwesomeIcon`.

| idx | Name | Root | Icon |
|---|---|---|---|
| `pages` | Pages | `/pages/content` | `file-code` |
| `pim` | PIM | `/pim/products` | `boxes-stacked` |
| `points` | Points | `/points/list` | `location-dot` |
| `forms` | Forms | `/forms/list` | `envelope` |
| `accounts` | Accounts | `/accounts/customers` | `users` |
| `checkout` | Orders | `/checkout-orders/orders` | `shopping-cart` |
| `agreements` | Agreements | `/agreements/list` | `file-contract` |
| `emails` | Emails | `/emails` | `at` |
| `faq` | FAQ | `/faq/groups` | `circle-question` |
| `pricing` | Pricing | `/pricing/prices` | `money-bill-wave` |
| `stock` | Stock | `/stock/manage` | `warehouse` |
| `translation` | Translation | `/translation-jobs` | `language` |
| `atlas` | Atlas | `/atlas/list` | `globe` |
| `pricefighter` | PriceFighter | `/pricefighter/gap` | `scale-balanced` |
| `enricher` | Enricher | `/enrichment` | `wand-magic-sparkles` |
| `promo` | Promo | `/promo/list` | `tags` |

This array is static metadata only. Whether a panel is *usable* is decided at
runtime by `useMuninStore().isPanelEnabled(idx)`.

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
| `/faq/...` | GroupList/Edit, ItemList/Edit |
| `/pricing/...` | PriceList/Detail, TaxClassList/Detail, ChannelList/Detail |
| `/stock/...` | WarehouseStockTable |
| `/translation-jobs` | TranslationDashboard |
| `/atlas/...`, `/suppliers/*` + `/supplier-review` (legacy redirects) | SupplierList/Detail, AutoMatched, Duplicates, SupplierReview (Review/) |
| `/pricefighter/...` | GapTable, Strategies, DecisionHistory |
| `/enrichment/...` | EnrichmentReview, EnrichmentSpawnRules List/Edit, EnrichmentTasks |
| `/promo/...` | PromoList/Edit, VoucherDetail |
| `/change-password`, `/password-reset` | ChangePassword (authenticated), PasswordReset (unauthenticated, from email link) |
| `/sso/callback` | SsoCallback (unauthenticated, return leg of the optional SSO login; `docs/sso-login.md`) |

Details for every child route are in `src/router/index.js` — this table maps
prefixes to view components, not individual paths.

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

### `VUE_APP_HIDE_DISABLED_PANELS`

Controls how locked panels render in the UI (not routing — the guard always
blocks disabled panels regardless of this flag):

- **Unset / not `"TRUE"`** (default) — locked panels render grayed out with a
  lock icon (`Home/index.vue` panel cards, `HeaderControls.vue` panel
  switcher dropdown), non-interactive.
- **`"TRUE"`** — locked panels are filtered out of the list entirely; only
  enabled panels appear.

Both `src/views/Home/index.vue` and `src/components/Navigation/HeaderControls.vue`
implement this independently: each maps the panel registry through
`munin.isPanelEnabled`, then filters by the env flag if hiding is enabled.
