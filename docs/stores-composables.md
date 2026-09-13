# Stores and Composables

## Pinia Stores

All 12 stores (`src/stores/`) use composition (setup) syntax with `defineStore`.

- **`useCheckoutChannelStore`** (`checkoutChannel.js`) — active checkout/promo
  channel, persisted per-user in `localStorage` (`checkout:lastSelectedChannel`),
  falls back to `VUE_APP_CHANNEL`. `fetchChannels()`, `setActiveChannel(idx)`.
  Own model (`checkout.Channel`) — never conflate with `pimChannel`.
- **`useContentDBChannelStore`** (`contentDBChannel.js`) — ContentDB channels
  and languages. `fetchChannelsAndLanguages()`; `defaultLanguage`,
  `availableLanguages` computeds.
- **`useHandyStore`** (`handy.js`) — Builder panel (Handy-kit) state:
  `open_Handykit()`, `pass_Asset()`, `changeState()`. Subscriber pattern via
  `triggerListener`.
- **`useLoaderStore`** (`loader.js`) — `loaderStart()`/`loaderFinish()`,
  `handyLoaderStart()`/`handyLoaderFinish()`. Auto-timeout 10s.
- **`useLookupFindStore`** (`lookupFind.js`) — the Find view's last lookup
  search (hits, query, scope, the downscaled photo Blob), restored on mount so
  back-navigation from a hit's details does not wipe the results. One search,
  no history, in-memory only.
- **`useMuninStore`** (`munin.js`) — module/panel enablement. See below.
- **`useNotifyStore`** (`notify.js`) — `spawnNotification({ title, msg, type,
  timeout })`. Types: `informative`, `positive`, `negative`, `warning`. Queues
  beyond 3 visible toasts (`MAX_VISIBLE`), pause/resume timers on hover.
- **`usePimChannelStore`** (`pimChannel.js`) — active PIM channel, persisted
  per-user in `localStorage` (`pim:lastSelectedChannel`). `fetchChannels()`,
  `setActiveChannel(idx)`; `activeChannelLanguages`, `allLanguages`,
  `isDefaultChannel` computeds.
- **`useQualityStore`** (`quality.js`) — soft-compat probe for the PIM gap-rules
  API (a layer inside django-pim, not a munin panel). `available` is `null`
  (unprobed) / `true` / `false`; `probe()` calls the gaps endpoint once and
  caches the result for concurrent callers.
- **`useRegionalStore`** (`regional.js`) — reference data from django-regional
  (languages, currencies, countries), cached for the session. `fetchAll()`;
  `languageById`/`currencyById`/`countryById` lookups.
- **`useTranslationJobsStore`** (`translationJobs.js`) — merges PIM and
  ContentDB translation jobs. `fetchJobs(channelIdx)`, `startPolling()` (polls
  while `hasActiveJobs`), `stopPolling()`, `setStatusFilter()`.
- **`useUserStore`** (`user.js`) — auth (JWT + refresh), session-expiry
  monitor, theme (`"default"`/`"dark"`), sidebar, `activeApp`, language,
  preferences. Cookie persistence via `universal-cookie`.

### `useMuninStore` API

Backs panel/module gating (see `docs/panels-routing.md` for the full model).

- **`isPanelEnabled(panelIdx)`** — true if any Munin module mapped to that
  panel (via `MODULE_TO_PANEL`) has `enabled_in_cms: true`, OR the panel is
  in the `VUE_APP_PANELS` env fallback and Munin does not report it at all.
- **`isModuleInstalled(moduleKey)`** — true if Munin reports the module at
  all (installed), regardless of `enabled_in_cms`. Always `false` before
  `loaded` — no env fallback (there's no reliable "installed" signal pre-login).
- **`isModuleEnabled(moduleKey)`** — true if the module is enabled in CMS.
  Before `loaded`, falls back to membership in the `VUE_APP_MODULES` env set.
- **`isModuleAtLeast(moduleKey, minVersion)`** — version-gate for backend
  feature detection (e.g. `"1.1.0rc0"` counts as `1.1.0`). Unknown
  module/version → `false` (safe lock). Never falls back to env — needs live
  module data.
- **`loaded`** — `true` once a Munin fetch returns admin data
  (`enabled_in_cms` present, i.e. an authenticated response). Until then, all
  panel/module checks run on the env fallback (`VUE_APP_PANELS`/`VUE_APP_MODULES`).
- **`ensureLoaded()`** — starts (or reuses) an in-flight `fetchModules()` call;
  the router guard awaits this before evaluating `meta.panel`.

## Composables

Located in `src/composables/` (12 total). Opt-in for new code; existing
components keep using stores directly via the `setup()` return pattern.

- **`useEntityFetch`** — factories for async-search inputs:
  `useCategoryFetch(channelIdx)`, `useProductFetch(channelIdx)` (PIM admin
  API), `usePageFetch()` (ContentDB navigation, client-filtered).
- **`useFormErrors`** — normalizes API error responses (v2 envelope, legacy
  `detail`, DRF field dicts) into per-field errors. Returns `errors`,
  `hasErrors`, `summary`, `handleApiError(err)`, `getFieldError`,
  `clearErrors`, `validateRequired(form, rules)`.
- **`useHandyKitSubscriber`** — watches `handy.triggerListener` to bind
  Handy-kit payloads onto component data (`instance`/`flat`/`custom`/`mixed`
  bind modes). Returns `{ setupSubscriber, open_Handykit }`.
- **`useLoginSession`** — turns a token pair into a CMS session (cookies,
  content permissions, profile + preferences, user, munin modules). Every
  login method calls `completeLogin({ access, refresh, customer_id })`;
  `consumeReturnRoute()` returns and forgets the route a session-expired
  logout stored.
- **`useLoader`** — thin wrapper over `useLoaderStore`. Returns `{ loading,
  handyLoading, start, finish, handyStart, handyFinish }`.
- **`useNotify`** — notification shortcuts over `useNotifyStore`: `{ success,
  error, info, warning, hide }`.
- **`useSearchDebounce(delay = 300)`** — debounced search input for list
  views. Returns `{ search, debouncedFetch(fetchFn) }`; timer auto-cleans on
  unmount.
- **`useAtlasBulkActions`** — bulk operations on supplier rows:
  `forceRepushSps(rows)`, `acknowledgeSps(rows)`. Both run in parallel and
  return `{ succeeded, failed }`.
- **`useUnsavedChanges`** — dirty-tracking for edit forms: `snapshot(data)`,
  `track(formData)`, `isDirty`, `guardNavigation(to, from, next)`,
  `confirmLeave()`/`cancelLeave()`. Warns on `beforeunload` while dirty.
- **`useVariantMatching`** — pure functions for variant-based conditional
  field visibility in config-driven UIs (Pages builder config-kit):
  `buildSettedConfigsValues`, `checkCoresDependency`, `checkPropsDependency`,
  `isAllOptionsDisabled`.

## Store Usage Pattern (Options API)

```javascript
export default {
  setup() {
    const loader = useLoaderStore()
    const notify = useNotifyStore()
    return { loader, notify }
  },
  methods: {
    async fetchData() {
      try {
        this.loader.loaderStart()
        const data = await apiCall()
      } catch (error) {
        this.notify.spawnNotification({ type: 'negative', msg: error.message })
      } finally {
        this.loader.loaderFinish()
      }
    }
  }
}
```
