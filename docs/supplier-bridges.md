# Supplier Bridges (Atlas panel)

Three integration layers connect the PIM and Atlas panels (Atlas is the supplier-integration panel, module key `atlas`). All read/write
supplier data through `src/api/atlas/api.js` — the PIM API client stays
untouched (zero coupling).

## PIM-side Bridge

`ProductList.vue` adds a `Supplier` column when
`useMuninStore().isPanelEnabled('atlas')` returns true. A single bulk
call `GET_BulkHasChanges(skus)` per page hydrates `supplierStatusMap`; rows
with `unseen_count > 0` render an "Updated" `StatusBadge`. Click navigates to
`/pim/products/{sku}#supplier` — `ProductDetail.vue` watches `$route.hash`
and `hasSupplierTab` to flip `activeTab` once `fetchSupplierStatus()`
resolves.

The `SupplierTab` (lazy-loaded, `views/Pim/components/SupplierTab.vue`)
renders `LinkedSuppliersPanel` + status line + Force re-push / Acknowledge
actions + `SupplierTimeline`. It also wires manual preferred-supplier
override: `ForcePreferredModal.vue` (`views/Pim/components/supplier/`)
collects a reason (min 3 chars, trimmed) and posts to
`POST_SetPreferredSupplier(sku, { supplierIdx, reason })`; "Reset to auto"
posts to `POST_ResetPreferredToAuto(sku)`.

API surface used (`src/api/atlas/api.js`): `GET_BulkHasChanges`,
`GET_SkuChanges`, `POST_AcknowledgeSku`, `POST_ForceRepushSku`,
`POST_SetPreferredSupplier`, `POST_ResetPreferredToAuto`.

## Atlas-side Bridge

Symmetric to the PIM-side bridge. `views/Atlas/tabs/ProductsTab.vue`
gains a warning "Updated" `StatusBadge` on `pushed`/`pushed_pending_images`
rows whose `data_changed_at > pushed_at`, a "Has unseen changes"
`FilterChip` (client-side filter on the current page), and the boot
`<BulkActionBar>` with two actions: force re-push selected (per-SP via
`POST_ForceRepushProduct(sp.id)`) and acknowledge selected (per unique
`real_product_sku` via `POST_AcknowledgeSku(sku, { all_unseen: true })`).
Bulk handlers live in the `useAtlasBulkActions` composable and aggregate
per-call success/failure into a single warning toast.

`views/Atlas/Review/SupplierReview.vue` registers an `Updated` mode
(lazy-loaded `UpdatedMode.vue`) — a cross-supplier list driven by
`GET_SupplierProducts({ status: 'pushed', ordering: '-data_changed_at' })` +
a client-side `isRowUpdated` filter, plus a per-supplier sidebar
(`<FilterChip :count>` aggregated from visible rows) and the same bulk
actions.

`ProductsTab`'s `SideDrawer` (`ProductCard` + `RawDataPanel`) gets two
sections when the panel is enabled and the SP has a linked SKU:
`SupplierProductTimelineSection` (wraps `SupplierTimeline` + diff renderers,
fetches via `GET_SkuChanges`) and `SupplierProductMappingSection` (lists the
supplier's mapping profiles with attribute + category counts; "Open Mappings
tab" emits `open-mappings` → `$router.push({ query: { tab: 'mappings' } })`).
`SupplierDetail.vue` watches `$route.query.tab` to flip `activeTab` when the
URL changes — mirrors the PIM-side `ProductDetail.vue` `$route.hash` pattern.

**`BulkActionBar` boot promotion:** the PIM-only
`views/Pim/components/BulkActionBar.vue` was promoted to
`src/boots/BulkActionBar/index.vue` with a generic
`:actions=[{ key, labelKey, buttonClass?, options? }]` API + `action(key,
value?)` emit. `ProductList.vue` passes its three actions (enable / disable /
visibility dropdown) via this prop. Add new bulk actions by appending to the
`:actions` array — no boot edit needed.

## Cross-supplier Dashboards

Three views live under `/atlas`:

- **`/atlas/auto-matched`** (`views/Atlas/AutoMatched.vue`) —
  distinct-SKU listing of every RealProduct touched by the auto-EAN-link
  path. A filter chip bar (`All`, `Has violations`, `Manual override only`)
  drives the query (`?has_violations=true`, `?manual_override_only=true`,
  `?source=<idx>`). Click a row to open `/pim/products/{sku}#supplier`
  (reuses the PIM-side hash-sync to land on the Supplier tab). The Suppliers
  column renders one `StatusBadge variant="positive"` per preferred link,
  `neutral` per non-preferred; the flags column shows `warning`/`informative`
  badges for tolerance violations and manual overrides.

- **`/atlas/duplicates`** (`views/Atlas/Duplicates.vue`) — one card
  per EAN group from `GET_Duplicates({ tolerance_pct: 10 })`. Each card has a
  `StatusBadge` for the suggestion (`positive` = merge, `warning` = review) +
  a flat `<table>` listing RealProducts with per-row `Merge to {sku}`
  buttons. Clicking opens `MergeConfirmationModal` (winner + loser passed as
  props). On successful merge, notify via
  `useNotifyStore().spawnNotification({ type: 'positive', msg })` + refetch.

- **`MergeConfirmationModal.vue`** (`views/Atlas/components/`) — follows
  the same shape as `ForcePreferredModal`: wraps `ConfirmationModal` from
  `@/functionals/Confirmation-modal`, owns a reason textarea (min 3 chars,
  trimmed) + confirm/cancel buttons. Posts to `POST_MergeByEan({
  winner_sku, loser_sku, reason })` and emits `confirmed(responseData)` on
  success, `cancelled` on close. Error states surface inline
  (`.merge-confirm__error`, `--negative-subtle`) instead of as a toast, so the
  modal stays open for retry. Cancel is blocked while a request is in
  flight.

API methods live in `src/api/atlas/api.js`: `GET_AutoMatched(params)`,
`GET_Duplicates(params)`, `POST_MergeByEan({ winner_sku, loser_sku, reason })`.
Nav icons reuse existing fa-icons (`faLink` for auto-matched, `faCopy` for
duplicates) — no new entries needed in `fa-icons.js` for these two views.

## Gotcha: `useNotifyStore` has no `.success()`

`useNotifyStore` only exposes `spawnNotification`, `hideNotification`,
`pauseTimer`, `resumeTimer` — always call
`spawnNotification({ type, msg })` directly on the store. The `.success()` /
`.error()` / `.info()` / `.warning()` shorthands exist only on the
`useNotify()` composable (`src/composables/useNotify.js`), which wraps the
store. Calling `useNotifyStore().success(...)` throws — it does not exist on
the store itself.
