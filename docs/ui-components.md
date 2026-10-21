# UI Components

## Global Components (Boots)

54 components registered globally in `src/boots/register-elems.js` (plus
FontAwesome icon registration in `src/boots/Icons/fa-icons.js`, loaded
separately in `main.js` — not a component — and the icon meaning registry
`src/boots/Icons/icons.js`, `$icons` in templates). Every component is shown on the catalogue page `/ui`
(§ P3 components).

Full list (generated from `register-elems.js`): ActionBar, AppHeader, BasicButton, BasicCard, BasicCheckbox,
BasicDatePicker, BasicImage, BasicInput, BasicLogo, BasicMenu, BasicModal, BasicRadioGroup, BasicSelect, BasicSwiper,
BasicSwitch, BasicTabs, BasicTextarea, BasicTooltip, BasicWysiwyg, BottomTabBar, Breadcrumbs, BulkActionBar,
ChannelMultiSelect, ColorInput, ConfirmDialog, CountBadge, DataTable, EmptyState, EntitySearchPicker, FilterChip,
FloatingActions, FormField, IconButton, Loader, MediaTile, MobileFilterPanel, MobileMenu, NoticeMe, NumberInput,
PageHeader, PageLayout, Pagination, PanelCard, SegmentedControl, SidebarNav, SidebarNavGroup, SidebarNavItem,
SideDrawer, StanceSwitcher, StatusBadge, SubscriberSetter, Tag, TranslationsDrawer, UserMenu.

New boots use `<script setup>` (plain JS). See `FloatingActions/index.vue` and
`DataTable/index.vue` as patterns.

Notable ones for list/form views:

- **`DataTable`** — see API below.
- **`FormField`** — label/hint/required/error wrapper for form
  inputs. Props: `label`, `hint`, `hintLevel`, `required`, `error`. The `label` slot replaces the caps label with the
  caller's markup (a numbered question) and keeps the label's `for` and id.
- **`EmptyState`** — placeholder for empty lists and panels. Props: `title`, `message`,
  `icon`, `size` (`md` full block, default; `sm` one line); the default slot takes an action. `DataTable` renders it
  for `emptyText`, one line by default; a list screen whose only content is the table passes `empty-size="md"`.
- **`Loader`** — loading indicator (`role="status"`), inline by default so it keeps its place in a modal, side
  panel or button; `block` centres it in the content area it stands in for.
- **`NumberInput`** — stepper field. A fractional `step` turns on decimal entry; typed text keeps one leading minus
  (only when `min` < 0), one decimal separator and digits. `disabled` locks the value and both steppers.
- **`ChannelMultiSelect`** — multi-select for channel scoping (`v-model`
  array of channel idx). Props: `modelValue`, `channels`, `label`, `allLabel`, `floatingLabel`.
- **`BasicSelect`** — an option may carry `description`, a muted line under its label. Never put a `?` tooltip
  inside an option: the bubble clips against the list's `overflow`. Options loaded in pages: `moreLabel` adds an
  action row at the end of the list that no query filters out; choosing it (click, Enter) emits `more`, keeps the menu
  open and its scroll position, and picks nothing. `search` emits the trimmed filter text on every change — the
  owner loads what the filter must reach (the PIM attribute values load the pages left on the first query, capped).
  Filtering stays local; there is no remote-search mode.
- **`BulkActionBar`** — sticky bar for bulk row actions. Props: `count`
  (required), `actions` (required: `variant` per action, `secondary` without one; an action with `options` is an
  action picker, a BasicSelect), `selectedLabelKey`, `clearLabelKey`. One wrapping row (count, actions, "Clear
  selection" at its end), so every action stays reachable on a phone; keep bulk actions `secondary`.
- **`SegmentedControl`** — single-choice toggle group. Props: `options`
  (required), `modelValue`; emits `update:modelValue`.
- **`StatusBadge`** — coloured status pill. Props: `label` (required),
  `tone` (`positive`/`negative`/`warning`/`info`/`neutral`/`accent`).
- **`MobileFilterPanel`** — collapsible filter drawer for small screens.
  Props: `activeCount`, `triggerLabel`.
- **`FilterChip`** — toggleable filter pill. Props: `label` (required),
  `active`, `count`; emits `click`. A global component — do not redefine
  `.filter-chip` styles locally.
  One chip set inline sits in `<div class="filter-chip-row" role="group" :aria-label="…">` (global, from this boot):
  it wraps on desktop and scrolls sideways in one row below tablet.

### DataTable

CSS Grid table for all list views. Uses `<script setup>`.

**Props:** `columns` (required), `rows`, `emptyText`, `sortable`,
`selectable`, `multiSelect`, `rowKey` (default `'uid'`), `rowAttrs` (`(row) => ({ "data-testid": … })`: attributes
of each row element, the hooks a page object finds a row by)
**Events:** `sort`, `select`, `row-click`
**Slots:** `cell-{key}`, `header-{key}`, `empty`

Column options (JSDoc in the component): `key`, `label`, `sortable`, `align`, `width` (a grid track; a px width
never drops below the header or an untruncated cell, and on a phone shrinks to that content), `truncate` (one line, ellipsis, `title` from `title(row)`, else
the value, or a slot cell's rendered text; on for cells without a slot; a truncated `fr` column is at least
max(120 px, its header)), `numeric` (right, tabular figures, no wrap), `actions` (right-aligned buttons,
`max-content` track), `priority` (2 hidden at `max-tablet` ≤ 768 px, 3 below 1024 px). A status (badge) column never
truncates: `width: "max-content"`. An empty value renders "—".

Pagination: `v-model:page` + `pages` (see § P3 display).

Sort: prop-gated, header click cycles null -> asc -> desc -> null, emits only
(parent handles sorting).
Selection: prop-gated, Shift+click range, Ctrl/Cmd+click toggle. The
component exposes `clearSelection()` (via `defineExpose`) for parent-driven
deselect after bulk actions — call it through a template ref.

## Custom Directives

Defined in `src/utils/directives/`.

**`v-out`** — Click-outside detection. Pass a string literal
(`v-out="'open'"`, sets that data key to `false`) or a callback function.
Never pass a boolean directly.

**`v-ripple-effect`** — Material ripple. Injects a `.ripple-effect-class`
span on click.

## Theme System

- **Attribute:** `data-theme="default"|"dark"` on `<html>`
- **Store:** `useUserStore().theme`, `useUserStore().setTheme(theme)`
- **Persistence:** `localStorage` key `cms_theme`, falls back to
  `prefers-color-scheme: dark`

### Colours, shadows, overlays

The semantic layer, per `[data-theme]`: `src/assets/tokens/semantic.json`, generated into
`src/assets/scss/themes/_semantic.generated.scss` (rules and roles: `docs/ui-rules.md` § Tokens).

### Focus Styles

`:focus-visible` uses `outline: 2px solid var(--accent)` with
`offset: 2px`. Defined in `src/assets/scss/utils/_reset.scss`.

## Mobile / RWD

**Breakpoints:** `768px` (mobile/tablet), `1024px` (the shell: sidebar from here up), `1279px` (desktop). Mixins:
`max-tablet`, `min-tablet`, `max-shell`, `max-desktop`, `min-desktop`
(`src/assets/scss/utils/_media-query.scss`).

**Grid gotcha:** Utility grid classes only apply at `min-width: 40rem`
(640px). Below that, use `display: flex; flex-direction: column`.

**`--bottom-bar-height`:** `72px` below the shell breakpoint, `0px` from it up and on a screen without the tab bar
(`:root` in `src/assets/scss/utils/_mobile.scss`, `.app--no-panel-nav` in `App.vue`). Use for fixed-bottom elements.

## Reusable UI Patterns

Page patterns, boot choice by job and UI rules live in `docs/ui-rules.md`.

- **`TranslateDialog`** (`src/components/TranslateDialog/`, P5 plan 50) — the one bulk-translate dialog (Pim product
  and store, Pages „Przetłumacz wszystko”): `v-model:open`, `scope` `product` · `store` · `content`, `title`,
  `summary`, `languages` `[{ label, value }]`, `sourceLanguage`; the caller keeps its API calls:
  `estimateFn(request)` → the raw estimate, `submitFn(request, estimate)` → the number of jobs created. Slot
  `languages` (under the targets; Pim adds a language to the channel through `PimTranslateDialog`).

## P3 components

One section per P3/P4 plan, in plan order. A plan writes only its own section (dev-plans § Streams); each section
matches the plan's block in `register-elems.js` and its section of the catalogue (`src/views/UiCatalogue/sections/`).

### P3 icons

`src/boots/Icons/icons.js` exports `ICONS`, a frozen `{ meaning: glyph }` map; templates read it as `$icons`
(`<FontAwesomeIcon :icon="$icons.edit" />`). Keys are camelCase (`saveDraft`, `importCsv`), one glyph per meaning
and one meaning per glyph (unit test). A new meaning adds its glyph to `fa-icons.js` (import and `library.add()`).
`BasicInput icon` and Pagination take their glyphs from it. Catalogue: `#icons`, every meaning at 16 / 20 / 24 px.

### P3 actions (plan 11)

- **`BasicButton`** — `variant` `primary` (accent fill, white text) · `secondary` (outline) · `ghost` · `danger`
  (every delete/remove/reject) · `danger-solid` (the destructive confirm of a dialog); `size` `md`
  (`--elem-height`) · `sm` (24 px) · `lg` (40 px at `radius-xl`, the sign-in screens; `primary` gets a soft top light on hover); label in the default slot; `icon` = a meaning of `icons.js`, drawn before the
  label (6 px gap); `loading` swaps the icon for a spinner, disables and sets `aria-busy`; `disabled`; `type`
  (`button` by default); without a `variant` it is `secondary`. The click stops at the button (`:stop="false"` lets
  it through); `click` carries the native event (`@click="go($event)"`). `mutates`: the button creates, changes or deletes — a read-only page hides it (`docs/ui-rules.md` §
  Page patterns).
- **`IconButton`** — every icon-only action: `icon` (meaning, required), `label` (required: `aria-label` + `title`),
  `variant` `ghost` · `outline` · `primary` · `danger`, `size` `sm` 24 · `md` `--elem-height` · `lg` 40 (header,
  mobile menu, `--radius-xl`), `pressed` (a toggle: `aria-pressed`, `surface-hover` fill), `disabled` (the glyph
  turns `text-disabled` in every variant but `primary`: a disabled `primary` keeps its `text-on-accent-fill` glyph
  and the whole button fades, `opacity: 0.5`, as FloatingActions). `danger` is
  every icon-only delete or remove (C6). The click stops at the button by default (`:stop="false"` to opt out); `click` carries the native event.
  `mutates` (a row's delete, a remove): hidden on a read-only page; view and open actions leave it off.
  A back control: `<IconButton icon="back" :label="$t('common.back')" />`. On a phone
  the hit area grows to 40 × 40 around the box, the box keeps its size. `md` matches the text button, not Figma's
  32 px (KD23).
- **`ActionBar`** — page and dialog actions in R5 order: `actions` = `[{ key, label, role, onClick, icon?,
  disabled?, loading?, expanded?, form?, mutates?, testid? }]` (`expanded` = `aria-expanded` of a button that shows a section;
  `form` = the id of a form the header button submits from outside it — native checks, the form's submit handler,
  and Enter in a field presses it), `role` `utility` (an IconButton, `icon` required) · `secondary` · `danger` ·
  `primary` (one at most, a second warns in dev); extra controls go into the default slot, already in order.
  Right-aligned, gap 12 px (8 px on a phone); below 768 px it takes its own row: the label „Akcje” above the actions, left-aligned (Figma S7).
  `labelled` false drops that label where the bar is already a footer of its own (BasicModal, ConfirmDialog).
  On a read-only page only the utilities stay, minus a `danger` one; `mutates` (true/false) overrides the role.
- **`FloatingActions`** — FAB 44 px `accent-fill`, 24 px inset from 1024 px up; below it 16 px inset and 16 px above
  the tab bar, `data-fid="fab"`;
  `actions[].icon` and `pill.icon` take meanings (other names still pass through until the sweeps). `pill` =
  `{ icon, label, handler, testid? }`: an important action with a visible label left of the FAB (R7). `open`
  starts with the speed-dial open.
- **`BulkActionBar`** — `actions[].variant` is a BasicButton variant (`secondary` without one); an action with
  `options` is a BasicSelect action picker.
- Codemod `scripts/codemods/p3-actions.mjs` (sweeps 17/18): colour classes → `variant`, `text` → slot,
  `isDisabled` → `disabled`, labelled buttons drop `icon`, icon-only → IconButton, `buttonClass` → `variant`;
  it flags the dark toggles, one-off colours, colours in `:class` and icon-only buttons it cannot name.

Catalogue: `#actions` (`#basic-button`, `#icon-button`, `#action-bar`, `#floating-actions`, `#bulk-action-bar`).

### P3 overlays (plan 12)

- **`useFocusTrap(container, { active, initialFocus?, onEscape? })`** (`src/composables/useFocusTrap.js`) — while
  `active`: focus moves in (the given element, else the first focusable), Tab / Shift+Tab cycle inside, Esc calls
  `onEscape`, the other children of `<body>` are `inert`, the body does not scroll; on release focus returns to the
  opener. Traps stack (the last one owns the keyboard). The container must be teleported to `<body>`; an `inline`
  overlay never activates one. Positioning of menus and tooltips: `useFloatingPosition` (`@floating-ui/dom`, flip +
  shift + offset, `position: fixed`).
- **`BasicModal`** — `v-model:open`, `title` (the `<h2>` that names the dialog; the `title` slot takes richer
  markup), `size` `sm` · `md` · `lg`, `persistent` (busy: Esc and backdrop do not close, the close button is
  disabled), default slot = body, `footer` slot or `actions` (→ `ActionBar`); emits `update:open` and `close`.
  `role="dialog" aria-modal`, teleported to `<body>`, `overlay-backdrop`, `surface-raised`, `--radius-xl`, `shadow-lg`, focus
  trapped. Below the tablet breakpoint: a full-width sheet at the bottom. Close button test id `basic-modal-close`.
  Other attributes (`data-testid`) land on the `role="dialog"` element.
- **`ConfirmDialog`** — on BasicModal `sm`: `v-model:open`, `title` (or slot), `message` (or the default slot),
  `confirmLabel` / `cancelLabel` (default „Akceptuj” / „Anuluj”), `tone` `default` (primary confirm) · `danger`
  (`danger-solid`), `loading` (spinner, Esc blocked), `discardLabel` (a third `danger` action for unsaved changes);
  emits `confirm`, `cancel` (Cancel, close, Esc, backdrop), `discard`. The caller closes it. Test ids
  `confirm-dialog-confirm` / `-cancel` / `-discard`; `confirmTestid` renames the confirm one (a page-object contract).
- **`BasicMenu`** — `trigger` slot (the menu sets the control's `aria-haspopup`, `aria-expanded`, `aria-controls`
  and toggles on its click), `items` = `[{ key, label, icon?, danger?, separator?, disabled?, to?, testid?,
  checked?, checkbox? }]` (`checked` = `menuitemradio`, with `checkbox` = `menuitemcheckbox`)
  (`role="menu"`; emits `select` with the item) or the `panel` slot (scope `close`, `role="dialog"` named by
  `label`); `placement` (floating-ui, default `bottom-start`); `sheet` (plan 56) for a panel that reads as text
  (configuration health): up to 32rem wide above a phone, a full-width bottom sheet pinned to the bottom edge on one
  (no floating position, `max-height: 85vh`, its own scroll). On a phone the sheet is modal like BasicModal's:
  teleported to `<body>` over a backdrop, body scroll locked, focus trapped (Tab cycles inside, it does not close the
  sheet), Esc or a backdrop tap closes it, focus returns to the trigger. A trigger with no focusable control (none,
  or a disabled one) leaves the menu root (`.basic-menu`, given `tabindex="-1"`) as the opener, never `<body>`; the
  root's `tabindex` goes again once focus leaves it for anywhere but the sheet. An open sheet survives a breakpoint
  crossing (a rotation) without a remount: the popover moves between the in-place slot and the bottom-sheet layer,
  the panel keeps its state and does not load again (its scroll position resets: the node is re-inserted). A `sheet`
  menu always renders a box-less `.basic-menu__layer` wrapper around the popover, so the popover is not a direct child
  of `.basic-menu`: never write a `.basic-menu > .basic-menu__popover` selector. `sheet` is fixed per instance: it is
  read once at setup, so a `sheet` that turns true after mount never becomes a bottom sheet — mount a new instance
  (`:key`) instead. Keyboard: ArrowDown on the trigger opens, arrows /
  Home / End move, Enter / Space choose, Esc closes and returns focus, Tab and a click outside close.
- **`BasicTooltip`** — wraps its trigger (default slot; its first focusable gets `aria-describedby`): `text`,
  `placement` `top` · `bottom` · `left` · `right` (flips when there is no room), `variant` `help` (the field-hint
  mark: a `?` button named „Pomoc” instead of the slot), `level` (help: `subtle` · `important`), `tipId` (a fixed id
  for the tip), `open` (forced). Shows on hover and keyboard focus, hides on Esc, blur and leave; a help mark toggles
  on a tap (touch); one opened with Enter / Space or a tap closes when focus leaves the tooltip, on a tap elsewhere
  and on Esc. The hints switch (`src/composables/fieldHints.js`) removes every help mark, the direct ones included
  (the builder's `ButtonsController` ×2, `GroupFieldsController`). There a reason why the items menu is disabled
  („add one first”) is a visible muted line, not a mark; only „select … to edit” and the RTL tip stay marks. A
  trigger holding only a disabled control makes the wrapper the tab stop (disabled with a reason).
  `IconButton` shows its `label` through it (no `title`).
- **`SideDrawer`** — focus trapped in `focused` mode (`role="dialog" aria-modal`, named by its title), Esc closes in
  both modes (sticky: while focus is inside), close = `IconButton` (`side-drawer-close`). The header (title, close)
  sticks to the top of the scrolling panel. **`TranslationsDrawer`**
  footer is an `ActionBar` (Save rightmost, `translations-save` / `translations-cancel`).
- `inline` (BasicModal, ConfirmDialog, SideDrawer, TranslationsDrawer, BasicMenu) renders the open state in the page
  flow: no Teleport, no backdrop, no trap (catalogue).
- Removed (lint, `scripts/lint/removed-components/overlays.json`): `ToolTip`, `HelpTooltip`, `HoverMe` →
  `BasicTooltip`; the `Confirmation-modal` / `Unsaved-changes-modal` wrappers are deleted (ConfirmDialog).
- Codemod `scripts/codemods/p3-overlays.mjs` (sweeps 17/18): the confirmation tags → `ConfirmDialog` (`visible` →
  `open`, `destructive` → `tone`, `accept` / `reject` / `save` / `stay` → `confirm` / `cancel`, a plain `#header`
  `<h2>` → `title`, `#description` → default slot), tooltips → `BasicTooltip` (`tip` → `text`, a standalone ToolTip
  or HelpTooltip → `variant="help"`), imports dropped; flags a custom `#footer`, a missing title, a computed
  `is_wrapper` and attributes outside the map.

- **`SecretReveal`** (`src/boots/SecretReveal/`, access plan 22) — a value shown once (a new or rotated API token): on
  BasicModal `md`; props `secret`, `title`, `open` (`v-model:open`), `inline` (catalogue). The value sits in a read-only
  monospace field (`autocomplete="off"`, `spellcheck="false"`) under the warning "This value is shown once…"; Copy
  uses `navigator.clipboard` and, without it, selects the text for a manual copy (a status line says which). Close
  (and Esc, the backdrop, the close button) works only after "I have stored it" is ticked. The value is copied into
  the boot's own state and `update:secret` hands the caller `""` at once — bind `v-model:secret` so the page drops its
  copy; close and unmount clear it, and the field is emptied before the dialog leaves. Never pass the value to a toast,
  a store, the router or a log. Test ids `secret-reveal-value` / `-copy` / `-stored` / `-close`. `tests/e2e/access-secret.spec.js`
  proves a created token's value is nowhere after close (`docs/access.md` § Token values).

Catalogue: `#overlays` (`#basic-modal`, `#confirm-dialog`, `#secret-reveal`, `#side-drawer`, `#translations-drawer`, `#basic-menu`,
`#basic-tooltip`), plus buttons that open the real overlays.

### P3 display (plan 13)

- **`StatusBadge`** — one state pill: `label` (string or number, also the `title`; the badge never grows past its
  cell and ends in an ellipsis), `tone` `positive` · `negative` · `warning` · `info` · `neutral` · `accent`, `dot`
  (default on), `size` `md` · `sm`; hollow (tone border, tone text), 12 px Inter 600 (`type-badge`). It replaced
  the global `.chip` (deleted).
- **`CountBadge`** — `count` in a 20 px pill (`surface-hover`, 11 px Inter 600, `type-count`), `999+` above 999.
  BasicTabs, FilterChip and the MobileFilterPanel trigger show their counts with it.
- **`Tag`** — a value chip (a picked entity, a media tag): `label`, `removable` adds a `close` IconButton `sm` named
  „Usuń: <label>” that emits `remove`, `to` makes the label a `router-link` to the entity (accent text).
- **`BasicTabs`** — `options` `[{ label, value, count?, testid?, disabled? }]` + `v-model` (unchanged); a `tablist` with one
  Tab stop (the active tab, else the first enabled one — never a disabled tab), ←/→ (wrapping), Home and End select and
  focus a tab, skipping disabled ones (a disabled tab takes no click either); active = accent text + 2 px accent underline.
  Tab `i` is `id="<idPrefix>-tab-<value>"` with `aria-controls="<idPrefix>-panel-<value>"`: the call site renders the
  panel as `<div role="tabpanel" :id="…-panel-<value>" :aria-labelledby="…-tab-<value>">`. Empty `options` render
  nothing. An option's `testid` lands on its tab.
- **`BasicCard`** — the card of `.page-card` (border-subtle, `--radius-3xl`, 24 px / 16 px below tablet): `title`
  (section title, Inter 600 16 px), `actions` slot (an ActionBar, right of the title), default slot; `gap` puts
  16 px between the children (off by default: children with their own `mb-*` keep their spacing). `flat` drops the
  frame (no border, no padding) for a card inside a container that already frames it (a SideDrawer, a modal).
- **`PanelCard`** — Home panel tile: `icon` (the panel's glyph from `configs/access.js`), `title` (Lexend Deca),
  `description`, `locked` + `lockedText` (opacity .5, lock, not focusable, no click), emits `click`; `surface-card`
  gradient, `--radius-3xl`, padding and gap 20 px, a plain 24 px icon, title and description 12 px apart; root class
  `panel-card` (e2e hook). The page sets `data-fid="panel-card"` on the one card Figma measures (Home: the first).
- **`MediaTile`** — media grid tile, 188 wide (150 below tablet) with a square image, `surface-raised`: `src` (none = image
  placeholder; `video` = a play badge over the image and the video icon as the placeholder; the image fills the box, `object-fit: cover`), `alt`, `caption` (truncated, full text in `title`), `selected` (accent
  border), `actions` slot (IconButtons `sm`), `overlay` slot (value chips, `Tag`, over the bottom of the image).
  Actions and overlay show on hover, keyboard focus inside the tile, when selected and always on a touch screen;
  hidden actions are `visibility: hidden` (the chips only fade), and a tile with actions is focusable itself
  (`role="group"`, named by caption or alt), so Tab reveals them. The page lays the tiles out (Gallery: fixed
  tracks, 4 × 188 from 1280 px, 2 below, in a bordered container).
- **`Loader`** — `size` 32 · 64 (64 by default), `block` centres it in a content area, `overlay` veils the
  screen (`overlay-loading`, 64 px rings, fades in and out), `overlay contained` veils the nearest
  positioned ancestor; `role="status"` with a visually hidden „Ładowanie…”.
- **`Pagination`** — `v-model:page` + `pages`; 32 px page squares 4 px apart, the current one boxed in accent, round
  prev/next arrows at opacity .5 when disabled, an ellipsis for many pages, nothing for one page. A computed page
  count is `:pages="Math.ceil(total / perPage)"` at the call site. `disabled` (a list still loading or busy) disables
  every cell, so a click is refused visibly instead of dropped.
- **`EmptyState`** — `icon` is a meaning of `icons.js` (`empty` for a list with no rows).
- **`MobileFilterPanel`** — the trigger is an `outline` IconButton `filter` named by `triggerLabel`, with a CountBadge.
- Codemod `scripts/codemods/p3-display.mjs` (sweeps 17/18): `.chip` + colour classes → `StatusBadge` `tone`
  (`:dot="false"` keeps the dotless look, `chip--sm` → `size="sm"`, `.chip__label` unwrapped); `<Loading>` →
  `<Loader overlay>` (`isHandy` → `contained`), import dropped. It flags `:class` bindings, click handlers, one-off
  colours and content that is not one text. `Loading` is a removed component (`removed-components/display.json`).

Catalogue: `#display` (`#status-badge`, `#count-badge`, `#tag`, `#basic-tabs`, `#basic-card`, `#panel-card`,
`#media-tile`, `#empty-state`, `#loader`, `#pagination`, `#filter-chip`, `#mobile-filter-panel`, `#data-table`).

### P3 page frame (plan 14)

- **`PageLayout`** — a page's content region: no border, no card (R4), padding 40 top / 80 sides (20 below tablet),
  one scroll body (`h-100 ovy-auto`). Slots `header` (a PageHeader), `toolbar` (the filters row), default (the
  content), `footer` (a list's Pagination, pinned to the bottom edge while the body scrolls). `roomy` keeps the
  desktop rhythm on a phone (40 top, 32 gap, the 30 px PageHeader title; Home, content list, Gallery). It replaces
  the bordered page container (plan 25). `--fab-lane` (set on the layout: the FAB's width plus its gap below the shell
  breakpoint, 0 above) is the right padding a bottom-pinned row takes to keep the FAB's corner clear — the footer
  uses it, a view's own sticky bar reads it (`padding-right: var(--fab-lane, 0px)`) instead of copying the size.
  It decides the page's read-only mode (`src/composables/useReadonly.js`) and provides it to the page; `readonly`
  forces it on. A read-only page shows one notice line under the header; FloatingActions (but its back button) and
  BulkActionBar render nothing and FormField disables its control — except in the toolbar and the PageHeader `meta`
  (filters and the channel picker read; `ReadonlyOff` lifts the flag there).
- **`PageHeader`** — `title` is the page's only `<h1>` (`.page-title`: Lexend Deca 30/400, 20 below tablet) in the
  title row (back, H1, meta: `data-fid="page-title"`, Figma's "Heading" frame); `overline` (Inter 13/500 uppercase, Home); `crumbs` `[{ label, to? }]` 24 px above the
  title row — omitted = the crumbs the shell provides (none without a shell), `[]` = none; `back` (a route location
  pushed on click, or a handler) = a ghost `back` IconButton left of the H1, 20 px gap; `sticky` pins the head (crumbs,
  back, title, meta) under the app header on a phone, flush with it and full width, on the page background (`data-fid="sticky-header"`); the
  actions row scrolls away. Slots `meta` (chips beside the title, they keep their width and wrap under a title they do not fit beside) and `actions` (an
  ActionBar): in the title row on desktop while both fit, otherwise wrapped under it right-aligned, and always its own
  row below 1024 px. The title stays on one line at every width: one longer than its row ends with an ellipsis and carries the full
  text in its `title` attribute; `wrapTitle` gives a long name (an article topic) two lines before the ellipsis. More
  `meta` chips than the row holds wrap inside it. Slot `tabs` (a `RouteTabs`: the screen's sections) takes a full-width
  row under the title row, and the `description` moves under it (it describes the tab); below 1024 px the actions row
  follows them, so a phone reads title → tabs → description → actions.
- **Shell claim** — `src/composables/pageHeader.js`: `PAGE_HEADER_CLAIM` (injection key) and
  `usePageHeaderClaim()`. The shell (P4) provides `{ claim, release, crumbs }` and hides its fallback header while a
  claim is held; claims overlap during a route change, so the provider counts them. PageHeader claims on mount,
  releases on unmount, and without a provider the claim is a no-op. `claim-shell="false"` keeps a demo instance (the
  `/ui` catalogue) out of the slot: no claim, no shell crumbs, the page keeps its own header.
- **`Breadcrumbs`** — `items` `[{ label, to? }]`, the last item is the current page (`aria-current="page"`, never a
  link); `<nav aria-label="Breadcrumb"><ol>`; Lexend Deca 16/400 (12 below tablet), `size="sm"` = 12 everywhere;
  ancestors `text-muted`, current `text-strong`, a `/` separator with 12 px gaps; long labels truncate with a `title`.
- `BackBar` is a removed component (`removed-components/page-frame.json` → PageHeader `back`); until a view moves to
  PageHeader its back control is an `IconButton icon="back"` (`label` „Wstecz”) or, with a visible label, a
  `BasicButton variant="ghost" size="sm" icon="back"`.

Catalogue: `#page-frame` (`#page-header`, `#breadcrumbs`, `#page-layout`).

### P3 selects (plan 15)

- **`BasicSelect`** — one choice from a list: `v-model` (a value, or an array when `multiple`), `options`
  `[{ label, value, description?, disabled? }]`, `placeholder` (default „Wybierz”), `searchable` (filter input above
  the list), `clearable` (a clear IconButton while something is chosen), `disabled`. Closed control: a
  `role="combobox"` button, `--elem-height`, `--radius-base`, `border-control`, 12 px Inter 500, `expand` caret;
  `multiple` shows the one label or „Wybrano: N”. The list opens in BasicMenu's panel (position, flip = drop-up,
  outside click, Esc, focus return) as a `listbox` driven by `aria-activedescendant`: arrows (wrap), Home / End,
  type-ahead, Enter / Space; checkboxes when `multiple` (an unticked one is an empty `border-control` box, never a
  filled glyph), a check on the chosen option otherwise. The list is at least as wide as the control (no 22rem cap),
  so the filter input never runs past it. Inside a FormField
  it takes the field's id, `aria-describedby`, invalid, required and disabled (`useFormFieldControl()`); outside one,
  `aria-label` / `aria-labelledby` on the tag name the control. `placement` and `inline` go to BasicMenu.
  `floatingLabel` (plan 53) names a select that stands without a FormField (toolbar, filter row, card header): empty,
  the control shows it as the placeholder; with a value it sits above the control as a 12 px `text-muted` line (not
  uppercase) and stays there; it is the control's `aria-label` unless `aria-labelledby` is given.
- **`EntitySearchPicker`** — async entity search: `fetchFn(search)` → `[{ label, value, secondary? }]` (300 ms
  debounce; `clientFilter` fetches once and filters here), `v-model` + `v-model:displayValue`, `placeholder`,
  `disabled`. The chosen entity is a removable `Tag` (remove → both cleared, `clear`); the list opens in
  BasicMenu's panel: a filter input driving a listbox, `secondary` as the option description. i18n `entity_picker.*`.
  `disabled` (or a FormField's) disables the control; `manual` swaps it for a plain text field for the value, no
  search (the Edit* modals without PIM).
- **`ChannelMultiSelect`** — channel scope chip (`channels` icon): „Kanały: Wszystkie” / „Kanały: 2”; `compact`
  (and every chip below the tablet breakpoint) shows „Kanały”. `v-model` = channel idxs, `channels` =
  `[{ idx, name? }]`, `label`, `allLabel`; the list is a multi-select listbox with checkboxes in BasicMenu's panel.
  `floatingLabel` (plan 53): the empty chip shows it; picked channels show the channel name („Wybrano: N” for several)
  in `text-body`, with the label above as in BasicSelect; the accessible name is „<label>: <value>”.
- The three share `src/boots/BasicSelect/OptionList.vue` (listbox rendering) and `useListbox.js` (keyboard).
  BasicMenu `inline` with a `top` placement draws the list above the trigger (the catalogue's drop-up).
- Removed (lint, `scripts/lint/removed-components/selects.json`): `Dropdown` → `BasicSelect`.
- Codemod `scripts/codemods/p3-selects.mjs` (sweeps 17/18): `Dropdown` → `BasicSelect`, `:values` → `:options`,
  `isDisabled` → `disabled`, `icon` dropped; `:selected="x ? [x] : []"` / `[x]` + an `@onSelect` that only assigns
  x → `v-model="x"` (a method keeps `@update:model-value="method"`); `:selected` alone → `:model-value`. Flags (tag
  left as it is): a handler that does more, a `:selected` that is not one assignable value, a missing `:selected`,
  `validate`, `custom_droplist`, `complex_values`, `can_remove_selected`, `@onUse`, `@onRemoveSelected`,
  `@onExtension*`, options with `label_ext*` in the file, any other attribute.

Catalogue: `#selects` (`#basic-select`, `#entity-search-picker`, `#channel-multi-select`; the `*-floating-*` cells).

### P3 inputs (plan 16)

- **`FormField`** — the only owner of a field's `label`, `required` (the red `*`), `error` (`role="alert"`, under
  the control) and `hint` (plan 60: the field-hint mark after the label — BasicTooltip `help`, a 16 px `?` in a 24 px
  hit area, 40 px on a phone; `hintLevel` `subtle` (default: a hollow ring, `text-muted` glyph) · `important`
  (filled `accent-subtle`, `accent` ring, semibold `text-strong` glyph) — see `docs/ui-rules.md` § Forms); `layout`
  `stacked` · `inline` (label left, control right from 1024 px, stacked below — Figma „Język treści”); `id` fixes the
  control's id, `disabled` disables it. It provides `FORM_FIELD` (`src/composables/formField.js`): `id` (the label's
  `for`), `describedBy` (the error, else the hint while hints are on), `invalid`, `required`, `disabled`, plus
  `labelId` for a control a
  `for` cannot name, and `reportError(message)` for a control that checks its own format (BasicInput `format`). Of several controls in one field (rows of a `v-for`) only the first takes the field's id.
  Controls read it through `useControlAttrs()` (`src/boots/FormField/useControlAttrs.js`) and
  paint their own error border. In BasicSelect and BasicInput a caller's `aria-describedby` (a note under the
  control) joins the field's error / hint id — `"<field id> <caller id>"` (`joinIds`) — instead of replacing it.
- **`BasicInput`** — `v-model`, `type`, `placeholder`, `icon` (a leading meaning of `icons.js`), `readonly` (the
  value behind a `lock`, the former `LockedField`), `disabled`, the native `maxlength`, `autocomplete`, `inputmode`, `min`, `max`, `step` (props, so they reach
  the `<input>`, not the wrapper); `--elem-height` (`size="lg"`: 40 px at `radius-xl`, the sign-in screens), slot `trailing` (a
  control inside the right edge, the text stops before it: the password reveal), `border-control`, the polish disabled
  look. No label or error text of its own (the FormField's). `null` / `false` show an empty field, `0` shows „0”.
  `focusOnCreate` focuses it on mount; events `onFocusout` / `onKeyDown` (Enter) carry the text; unknown listeners
  and classes land on the wrapper. `format` (plan 61, `src/utils/formats.js`: `money` · `percent` · `integer` · `ean`
  · `code` · `key` · `slug` · `email` · `url` · `iso2` · `iso4217`) shows the model in that format (money with the
  UI language's decimal separator), keeps the text as typed while focused and puts the parsed value in the model
  (`"232,5"` → `"232.50"`); once the field is left a wrong value is `aria-invalid` and its message is the FormField's
  error (`reportError` of `FORM_FIELD`; the caller's `error` wins). `min` / `max` / `pattern` (the API regex of a
  `code` / `key`) are its rules. The save still checks the form: `useFormErrors().validateFormats`.
- **`BasicTextarea`** — replaces `TextAreaBasic`: `v-model`, `rows` (4), `maxlength` (with an „n / max” counter),
  `placeholder`, `disabled`, `readonly`, `autogrow` (grows with its text from `rows` up to the max height).
- **`NumberInput`** — `disabled`; the value field reads the contract.
- **`BasicCheckbox`** — one checkbox: a boolean `v-model`, its label in the default slot, `disabled`. A list of ids
  is `BasicSelect multiple`.
- **`BasicRadioGroup`** — `options` `[{ label, value, disabled?, testid? }]`, `v-model`, `name`, `disabled`; native
  radios in a `role="radiogroup"` (one Tab stop, the arrow keys move and select), named by the FormField label. An
  option's `testid` lands on its radio input. `layout="tiles"` draws the options as a grid of square tiles from the
  `option` slot (`{ option, checked }` — a thumbnail; keep `label` as its accessible name), the picked one in the
  accent border (`PicturePicker`); `layout="cards"` the same as wider cards of any height, one per row on a phone (the
  AI studio's cover variants: a 16:9 image and its title).
- **`BasicSwitch`** — replaces `Switcher`: `v-model`, `label`, `hint` + `hintLevel` (the field-hint mark), `disabled`; a
  `role="switch"` button with `aria-checked`, styles scoped to it.
- **`BasicDatePicker`** — an input-looking trigger with the `calendar` icon opens an inline flatpickr; `v-model` (the
  flatpickr date string), `config` (a single date by default, `mode: "range"` for a range), `disabled`; the instance
  lives only while the calendar is open. `fixed` places the calendar against the viewport (upward when there is no
  room below), so a scrolling parent such as a wide table does not clip it. Its label is the FormField's. The trigger's click reaches the document, so other
  popovers close; a click inside the open calendar never closes it.
- **`SegmentedControl`** — contract id and `disabled`, named by the FormField label, `aria-pressed` on the active
  option; an option's own `disabled` takes just that option out. **`ColorInput`** — `disabled`, the text field reads the contract, the swatch is the native picker itself
  (named by the FormField label, else „Wybierz kolor”).
- Codemod `scripts/codemods/p3-inputs.mjs` (sweeps 17/18): `Switcher` → `BasicSwitch` (`:selected` + `@onSelect="x =
  !x"` → `v-model`, `prevent` → `disabled`), `TextAreaBasic` → `BasicTextarea` (`limit` → `maxlength`), `LockedField` →
  `BasicInput readonly`, `isDisabled` / `is_disabled` → `disabled` on BasicInput, NumberInput and the textarea, a
  floating `label` → a `FormField` around the control (dropped inside a labelled FormField). It flags other
  `@onSelect` handlers, `validate`, the checkbox array API and the old textarea API. `Switcher`, `TextAreaBasic` and
  `LockedField` are removed components (`removed-components/inputs.json`).

Catalogue: `#inputs` (`#form-field`, `#basic-input`, `#basic-textarea`, `#number-input`, `#basic-checkbox`,
`#basic-radio-group`, `#basic-switch`, `#segmented-control`, `#basic-date-picker`, `#color-input`, `#basic-wysiwyg`,
`#permission-matrix`).

### PermissionMatrix

**`PermissionMatrix`** (`src/boots/PermissionMatrix/`, access plan 20) — the areas of the django-access catalogue ×
none/read/write. Props: `areas` (the catalogue's `modules`: `[{ module, areas: [{ key, label, levels, sensitive,
assignable }] }]`), `v-model` (`{ "<area>": "read" | "write" }`, no key = none), `disabled` (also on a read-only
page), `showReserved` (renders the `assignable: false` areas — `access.manage` — for a built-in role's read-only
view; a custom role never sees them). Each area is one native radio group named by its label; a level the area does
not offer is disabled (struck through). Each module has a "set all" `SegmentedControl` that clamps per area (write
on a read-only area = read, read on a write-only area = none) and never reaches a hidden area. Sensitivity flags
are `Tag`s (`access.sensitive.<flag>`). Labels are text only: `access.areas.<key>` / `access.modules.<module>` when
translated, else the catalogue's English label — every area of today's catalogue has both locales
(`tests/unit/i18n/accessKeys.spec.js`). The rules are `matrix.js` (`toPermissionKeys` builds the API's
`<area>:<level>` list from assignable areas only).

### P4 shell (plan 21)

In the catalogue and live: `App.vue` mounts `AppHeader`, `SidebarNav` (desktop), `MobileMenu` and `BottomTabBar`
(below the shell breakpoint) and `ShellPageHeader` at the top of `<main>` (plan 22); the old shell is gone.

- **Nav model** — `src/composables/useNav.js`, the one answer to every shell question. `usePanels()` = the
  `access.js` registry × Munin (`isEnabled`), locked panels dropped under `VUE_APP_HIDE_DISABLED_PANELS=TRUE`;
  `navTree(ctx)` = `{ [panelIdx]: entries[] }` through `filterNavRoutes` per panel (`ctx` = `qualityAvailable`,
  `isModuleEnabled`, `isDesktop`); `resolveNavEntry(entries, route)` lights an entry in the order exact path →
  `activeOn` → `meta.navParent` → longest path prefix; `useActiveNav()` = `{ panelIdx, entry, tree }`, the panel from
  `route.meta.panel` (`"home"` on `/`). A detail or create page whose path does not nest under its list sets
  `meta.navParent: "<entry route>"` (9 routes: Points, Forms, Agreements, Atlas, Promo).
- **Breadcrumbs** — `useBreadcrumbs(title?)` → `{ crumbs, backTarget, back }`: panel → entry → the
  `meta.crumbParent` chain (route names, e.g. `EmailTemplateEdit` → `EmailTemplateList`, linked with the params the
  parent takes) → the current page (`title`, else the route's `titleKey`). Nothing on a panel's list (R3); a panel
  root that is also the entry keeps both crumbs. `back()` goes to the last linked crumb: history back when the
  previous entry is that crumb (list filters survive), else a push.
- **Breakpoint** — `SHELL_BREAKPOINT` (1024, `src/utils/breakpoints.js`) = `$breakpoint-shell`; `useIsDesktop`
  reads it. A unit test holds the SCSS and script values together.
- **`AppHeader`** — `<header data-fid="header">`: the wordmark home link (`data-fid="logo"`), then ConfigHealth and
  the bell (conditional; a phone reaches ConfigHealth through the user menu) and `UserMenu`, 12 px apart. The bell
  and ConfigHealth are IconButtons (`notif-bell`, `config-health-button`) that open their lists in BasicMenu's
  `panel` mode. 88 px on desktop, 81 px below the shell breakpoint with a hairline separator
  and the `menu` / `close` IconButton (`aria-expanded`, `aria-controls` = `menuId`, `v-model:menuOpen`). No title,
  no panel switcher (R1, R2). `mobile` forces a layout.
- **`SidebarNav`** — `<nav aria-label="Panele" data-testid="app-sidebar" data-fid="sidebar">`, 300 px, its own
  scroll: "Panele", Home, every panel in registry order. A panel with more than one entry is a
  `SidebarNavGroup` disclosure (`button[aria-expanded][aria-controls]`), one entry is a leaf link, a locked panel is
  dimmed with a lock, unfocusable, "(niedostępny)" for screen readers. The active panel's group opens on
  activation; the others toggle per session. `collapsed` (default: the user store, `cms_sidebar_collapsed`) is the
  64 px rail: icons named by `aria-label` with a BasicTooltip, toggled by the footer IconButton (`aria-expanded`;
  with the `collapsed` prop set it reports `update:collapsed` and writes no preference).
  `flat` is the MobileMenu list (no title, no footer, each panel one link to its root).
- **`SidebarNavItem`** — `label`, `icon` (a FontAwesome glyph of the nav model), `to`, `level` 1 (40 px, Lexend
  16/400) / 2 (32 px, 14/400, 1 px `hairline` rail → `accent` when active), `active` (`aria-current="page"` on a
  link on its own page, `"true"` on a page below it), `locked`, `expanded` (set = a disclosure row, emits `toggle`), `collapsed`. Group rows hover with a
  `surface-hover` pill, links change colour only; the inactive L2 text is `text-secondary` (KD22).
- **`MobileMenu`** — `v-model:open`: a full-screen `role="dialog" aria-modal="true"` below the header with the flat
  SidebarNav (`data-fid="mobile-menu"`); its close button sits over the header's menu button. `useFocusTrap`: focus on
  close, Tab cycles, Esc closes, focus returns to the menu button, the background is inert; a navigation closes it.
  `inline` = open in the page flow without a trap.
- **`BottomTabBar`** — `<nav aria-label="<panel>" data-fid="tab-bar">`, 72 px (= `--bottom-bar-height`): the current
  panel's entries, icon + 12 px label, items ≥ 44 px, the lit one `aria-current`; hidden with ≤ 1 entry and on
  `meta.noBottomBar`. `entries` / `label` / `current` take fixed data (catalogue). No panel has more than 5 phone
  entries (a unit test guards it: there is no overflow design).
- **`UserMenu`** — on BasicMenu (`aria-haspopup="menu"`): the user's name (a BasicMenu `heading` item), the theme
  item naming its target ("Tryb jasny" / "Tryb ciemny"), „Podpowiedzi przy polach” (`menuitemcheckbox`, on by
  default; `setHints` saves `cms_hints` like the theme: profile `extra`, localStorage, applied on sign-in), the languages (`menuitemradio`, the current one
  `aria-checked`; BasicMenu items take `checked`), configuration health (with
  munin), change password, logout (`danger`). Trigger: IconButton `lg` `user`, `data-fid="user-button"`.
- **`BasicLogo`** — `variant="full"` is the "ENTIRIUS CMS" wordmark, `size` its height (32 → 206 × 32, 24 → 154 × 24);
  its gradients belong to the asset (D2), the name turns `text-strong` in the light theme — unless `onDark` (an
  always-dark surface: the sign-in stage).

Catalogue: `#shell` (`#app-header`, `#sidebar-nav`, `#sidebar-nav-group`, `#sidebar-nav-item`, `#mobile-menu`,
`#bottom-tab-bar`, `#user-menu`, `#basic-logo`).

## P5 patterns

How a panel screen is put together since P5. The rules are `docs/ui-rules.md` (Page patterns, Forms); this section is
the component recipe.

### Page frame (plans 25, 56)

- One `PageLayout` per view: `#header` = `PageHeader` (the only H1), `#toolbar` = the search and filter row, default
  slot = the content, `#footer` = `Pagination`. `roomy` only on the Figma frames (Home, content list, gallery).
- Page actions: PageHeader `actions` → `ActionBar` (R5). Panel-wide controls (channel selector): PageHeader `meta` or
  the ActionBar. „Tłumacz sklep” is the Translation page's primary action, in no Pim view. No panel toolbar strip, no
  `<Teleport to="#…toolbar">`.
- A route without a PageHeader still gets one H1: the shell's fallback `PageHeader` (crumbs + the route's `titleKey`).
- `FloatingActions` keeps its own inset (24 px desktop, 16 px above the tab bar); a view passes `actions` / `pill`,
  never a position. A view never overrides the frame from outside (`:deep(.page-header__title)`, PageLayout padding).

### Sign-in frame (plan 59)

- **`AuthLayout`** (`src/boots/AuthLayout/`, imported locally, not in `register-elems.js`) — the frame of the login
  wall, password reset, change password and the SSO callback. Desktop (from the shell breakpoint): the brand stage
  (always dark, `aria-hidden`: three light fields drifting on transform only, 31–45 s, paused while focus is in the
  form and still under reduced motion; grain, a fading dot grid, the wordmark, an editorial line, the copyright line)
  beside the form column (380 px, `surface-page`, follows the theme). Below it the stage is a 32 vh band with the
  wordmark and the form a sheet over it (24 px top radius; 480 px column on a tablet). Props: `title` (the one H1),
  `subtitle`, `statusTone` (`negative` · `positive` · `warning`); slot `status` = the one `aria-live` summary (session
  expired, form errors, link sent), default slot = the form. The editorial line is the `type-display` role (Lexend
  Deca 300, 48/56 px, brand tracking; `--fs-display` 48 px is its step in the size scale the census checks). Form
  controls use `size="lg"`; a focused control gets a
  soft accent halo outside its ring (spread 8 px beyond the 2 px outline at a 2 px offset).
- **`AuthLayout/PasswordField`** — FormField + `lg` BasicInput with the show/hide `IconButton` (`pressed`) in its
  `trailing` slot and a caps-lock hint under the input (its own line, not the description, so it stays next to a
  password error): an always-present `role="status"` line, visually hidden and empty while caps lock is off, named
  by the input's `aria-describedby` while it shows. `autocomplete`
  `current-password` (default) or `new-password`.
- Errors go under their field (FormField `error`) and once into the `status` slot; never a toast. The new-password
  checks (filled, confirmation matches) are `passwordErrors` in `src/utils/passwordForm.js`.

### Filters (r06 §8)

- One chip set: `FilterChip`s in one `.filter-chip-row` inline in `#toolbar` (wraps on desktop, scrolls sideways on a
  phone). More than one filter group: `MobileFilterPanel`.
- A filter select is a `BasicSelect` with `floatingLabel` (the field's name, never „Wszystkie …”: that is the empty
  option's label). The same goes for every `BasicSelect` outside a FormField (card and page headers, the builder
  controllers, the Handy kit); a count the old placeholder carried stays in the label („Ustawione (2/5)”). An action
  picker (`:model-value="null"` with its handler on `@update:model-value`: „Dodaj istniejące pytanie”, „Zmień
  status”) keeps its prompt as the placeholder: it holds no value to name. A `ChannelMultiSelect` chip names itself
  („Kanały: Wszystkie”): an empty pick means every channel, which a floating label would hide.

### Configuration health panel (plan 56)

`BasicMenu sheet`: ≈ 30rem wide on desktop, a bottom sheet on a phone. A failing check reads top-down — the title at
16 px / 600, the detail at 14 px, „Jak naprawić” as a link under them — with its status stripe on the left; env-var
names (`EMAIL_HOST`) and URLs are `<code>` in the mono font and the only text that may break mid-word
(`textTokens`, `src/utils/configHealth.js`). Passing checks are the chip row, then „Sprawdzono …” and „Sprawdź ponownie”.

### Detail form (plan 33)

The layout of every detail (edit / create) screen; Faq (`src/views/Faq/GroupEdit.vue`, `ItemEdit.vue`) is the
reference. It replaces the view-local `detail-section` / `detail-grid` / `detail-field` / `detail-label` classes.

| Was | Is |
|---|---|
| `detail-section` + its `<h2>` | `BasicCard :title gap` (16 px under the title); cards 32 px apart (`mb-8`) |
| `detail-grid` | `.form-grid` (`utils/_decorators.scss`): 1 column up to 768 px, 2 above; gaps 16 px rows, 24 px columns |
| `detail-field` + `detail-label` / `.field-label` | `FormField` (`label`, `required`, `hint`, `error`) around the boot control |
| a field as wide as the card (question, rich-text answer) | `FormField class="form-grid__wide"` |
| a section action (add a row, add an existing item) | BasicCard `actions` slot |
| Save · Delete · Translations in the panel wrapper's toolbar | PageHeader `actions` → `ActionBar` |

- **Fields.** One FormField per field; the control carries no label, placeholder-as-label or error of its own.
  `:error="formErrors.getFieldError('<field>')?.msg || ''"` on every field the API can name, `required` where the
  save validates or the API refuses an empty value, `hint` for what a label cannot say (`hintLevel="important"` for
  fixed after create, a subtle hint for empty = every channel). A field-level action (per-field translations) is an `IconButton` right of the control, in a
  `flex ai-st gap-3` row, named after the field („Tłumaczenia: Pytanie”).
- **Actions.** PageHeader `actions` holds, left to right: the unsaved `StatusBadge`, the record's on/off
  `BasicSwitch` (when it has one), then an `ActionBar` — Translations (`utility`, `translate`), Delete (`utility`,
  `delete`, `variant: "danger"`, opens a `ConfirmDialog tone="danger"`), Save (`primary`). An `ActionBar` utility
  takes `variant` (the IconButton variant, `outline` by default). The header renders after the load, so Save and
  Delete never act on an empty form. The panel wrapper keeps no toolbar.
- **Lists inside a detail** (items of a group, associations) stay rows in the card; a row that opens a record is a
  `router-link`, never a click-only `span`.

```vue
<template #header v-if="!loading">
  <PageHeader :title="group.name" back="/faq/groups">
    <template #actions>
      <div class="flex ai-ct jc-fe wrap gap-3">
        <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
        <BasicSwitch v-model="form.is_active" :label="$t('faq.is_active')" />
        <ActionBar :actions="headerActions" />
      </div>
    </template>
  </PageHeader>
</template>
<BasicCard :title="$t('faq.group_details')" gap class="mb-8">
  <div class="form-grid">
    <FormField :label="$t('faq.name')" required :error="formErrors.getFieldError('name')?.msg || ''">
      <BasicInput v-model="form.name" />
    </FormField>
    <FormField :label="$t('faq.channels')" :hint="$t('faq.channels_hint')">
      <BasicSelect v-model="form.channel_ids" multiple :options="channelOptions" />
    </FormField>
  </div>
</BasicCard>
```

No view has `.detail-*` classes any more, and `utils/_decorators.scss` holds no `.detail-*` rule.
