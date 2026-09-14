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
- Sidebar/mobile-bar routes come from `src/components/Navigation/nav-routes.js`
  (`buildNavRoutes()` / `filterNavRoutes()`), consumed by both
  `Navigation.vue` and `App.vue` — not hardcoded per-component. `App.vue`
  hides the sidebar entirely for single-tab panels (enrichment, emails,
  accounts, checkout, stock).
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
- A page that fills the viewport has to set its own `overflow-y: auto`.
  `App.vue` renders the route inside `.app-content-col.ov-h.router-container`,
  within a `.layout` that is `overflow: hidden; height: 100%`, and hands the
  route `class="h-100"`. The shell clips on purpose and every page scrolls
  itself, so a full-height root with no overflow of its own lays out past the
  fold and anything below it cannot be reached.
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

- `useSearchDebounce` — list search. Never duplicate debounce logic inline.
- `useFormErrors` — edit/create field-level validation. All edit views MUST
  use it.
- `FormField` — wraps label + slot + description. Use for ALL form fields.
  `:tooltip` renders a `?` `HelpTooltip` next to the label (the field-level
  equivalent of `Switcher :hint`); `:description` renders a muted line below
  the field.
- `EmptyState` — standardized no-data display (`title`, `message`, `icon`
  props).
- `ChannelMultiSelect` — channel multi-select with a globe icon, responsive
  (icon-only on mobile).
- `HelpTooltip` — inline `?` icon with a hover/focus bubble (`:text`). Use to
  explain non-obvious fields/toggles. The `Switcher` boot has a built-in
  `:hint` prop for the same purpose (click on `?` is `@click.stop`, won't
  toggle the switch).
- `Dropdown` options support an optional `el.description` field in
  `:values` — renders a muted secondary line under the option label (use for
  terse labels that need a fuller explanation, e.g. discount modifiers).
  Don't put a `?` tooltip inside dropdown options — the bubble clips against
  the list's `overflow`.
- `MobileFilterPanel` + `FilterChip` — filter UI on list views.
