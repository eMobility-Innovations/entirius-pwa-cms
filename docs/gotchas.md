# Gotchas

Repo-specific traps. Read before touching configs, i18n, or panels.

- Restart the dev server after changing config JSON — dynamic `import()` is
  cached.
- `__client/` is gitignored — each deployment has its own configs; never
  commit it. See `docs/config-system.md` for the full file map and
  `scripts/init-client.js` generation flow.
- Global components register in TWO files: `src/boots/register-elems.js` (UI
  components) AND `src/configs/builder/components/register-elems.js`
  (builder config controllers). Adding one without the other fails silently.
- Sidebar / tab-bar routes come from `src/components/Navigation/nav-routes.js`
  (`buildNavRoutes()` / `filterNavRoutes()`) through the nav model
  (`src/composables/useNav.js`) — not hardcoded per component. The sidebar
  shows on every authenticated route (Home and single-entry panels included);
  the phone tab bar hides for a panel with one entry. The active panel is
  `route.meta.panel`: there is no active-panel state in a store.
- Points panel import view is commented out (nav + router). Imports are
  CLI-only via `manage.py import_deliverypoints`. Files kept but unreachable.
- Carrier types are read-only in `Points/TypeList.vue` — clicking shows an
  informative toast, no edit modal.
- `plugins/vuex.js` does NOT exist in the CMS (pure Pinia) — do not confuse
  with storefront patterns.
- Panel enablement is driven by the Munin API (`enabled_in_cms` flag).
  `VUE_APP_PANELS` is a gap-filling fallback only, not an override — toggling
  it does not re-enable a panel the backend has explicitly turned off. See
  `docs/panels-routing.md`.
- **New panel icon checklist:** when adding a panel, the icon string in
  `access.js` / `nav-routes.js` must also be imported in
  `src/boots/Icons/fa-icons.js` (both the `import {}` statement AND the
  `library.add()` call). Missing imports fail silently — no console error,
  the icon just doesn't render.
- A full-height page owns its own scrolling. `#app` and `.app-main` are
  `overflow: hidden` and the route's `router-view` gets `h-100`, so the shell
  clips. Build pages on `PageLayout`, which scrolls itself (`ovy-auto`). A page
  that bypasses it must set its own `overflow-y: auto`, or content below the
  fold is unreachable. Nothing warns, and jsdom/happy-dom applies no scoped
  SCSS, so a unit test cannot catch it.
- `PimField.vue` (`views/Pim/components/`) is a legacy alias for the
  `FormField` boot component — use `<FormField>` directly in new code.
- Project i18n is a hand-rolled reactive `state.lang` (no vue-i18n). Only
  `$t(key, params)` is wired globally — `$tc` does NOT exist in production
  (only mocked in `tests/unit/setup.js`). For pluralization, format the count
  into a single string (`"{count} unseen change(s)"`) rather than a
  `singular | plural` pipe.
- Tab hash sync in `ProductDetail.vue` runs in `mounted()` AND watches
  `hasSupplierTab` — because `fetchSupplierStatus()` is async, a direct
  `#supplier` deep link reaches `mounted()` before the tab exists. The
  watcher re-applies once the tab flag flips true. Reuse this pattern for any
  future async-conditional tab.

## ContentDB Channels

`useContentDBChannelStore` centralizes channel and language data for all
ContentDB views (Builder, Builds, Authors, ContentSets). It fetches
`GET_ContentChannels` and `GET_Languages` once and exposes `channels`,
`languages`, `defaultLanguage`, `availableLanguages`. `Builder.vue` uses the
`ChannelMultiSelect` boot component for channel assignment — empty selection
means public (all channels); the draft payload includes `channels: [idx1,
idx2]`.

## Standard Patterns for New Panels

See `docs/ui-rules.md` — the only CMS UI rule file (boots by job, page patterns, forms).
