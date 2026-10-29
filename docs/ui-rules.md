# CMS UI rules

How CMS screens are built. This is the only file that states CMS UI rules: plugin rules, skills, agents and the
other docs point here and do not repeat it. Code is the source of truth. Values live in tokens and components live
in `src/boots/`. This file names them and never restates a value. Lint enforces what it can: run `npm run lint:ui`.

## Sources of truth

| What | Where |
|---|---|
| Tokens (colour, spacing, type, radius, shadow, overlay) | `@entirius/brand-tokens` + `src/assets/tokens/semantic.json` (generated into `src/assets/scss/themes/_semantic.generated.scss`); the scale lists in `src/assets/scss/variables/`, emitted by `main.scss` |
| Components | `src/boots/` + `src/boots/register-elems.js`; API in `docs/ui-components.md`; catalogue page `/ui` (`src/views/UiCatalogue/`) |
| Icons | the meaning registry `src/boots/Icons/icons.js` (`$icons` in templates); glyphs registered in `src/boots/Icons/fa-icons.js` |
| Breakpoints | `src/assets/scss/utils/_media-query.scss` (mixins `max-tablet`, `min-tablet`, `max-desktop`, `min-desktop`) |
| Lint | `stylelint.config.mjs` (T rules), `eslint.config.mjs` (C rules) |
| Design reference | Figma snapshot, frozen (see § Designs) |

## Tokens

Two layers: `@entirius/brand-tokens` (`--brand-*`, never used directly in views) and the CMS semantic layer on top
of it. The semantic source is `src/assets/tokens/semantic.json`: its `color`, `overlay`, `shadow` and `type` groups
are generated into `themes/_semantic.generated.scss` (`node scripts/tokens/build-theme.mjs`, a unit test fails when it
is stale; never edit the output by hand; `node scripts/tokens/contrast-light.mjs` proves the light theme's WCAG
pairs and runs in the same unit spec). Its `space`, `radius`, `font-size` and `font` groups name the scales that
`main.scss` emits from the lists in `src/assets/scss/variables/`; the parity check (`@parity`) holds both to the same
values.

- **T1 Colour comes from a semantic token.** Use `var(--surface-*)`, `--text-*`, `--border-*`, `--focus-ring`,
  `--accent*`, `--positive*`, `--negative*`, `--warning*`, `--info*`, or the classes the map names: `bg-*` (surfaces),
  `t-*` (text), `b-*` / `bt-*` / `bb-*` / `bl-*` / `br-*` (borders), all three for accent and status, most with a
  `-hover` variant (`t-accent-hover`, `bg-accent-hover`, `b-accent-hover` are the `accent-hover` token itself). Pick the token by the role the map gives it, never by a number. No hex, `rgb()`, `rgba()`,
  `hsl()` or named colours outside the token files. Form fields (input, select, textarea, checkbox, radio) sit on
  `surface-sunken` with a `border-control` edge. On `accent-subtle` text is `text-strong` or `text-body`, in light also
  `text-accent` (5.87:1, proven by `scripts/tokens/contrast-light.mjs`), never `text-muted` and never `text-accent` in
  dark; on `accent-fill` it is `text-on-accent-fill`.
- **T2 No fallback on a token.** `var(--text-body, #fff)` hides a missing token in one theme. Every `var()` names a
  token that exists (brand, semantic, a scale below, or one declared in the same file); lint flags unknown ones.
- **T3 Spacing comes from `--space-*`.** The brand steps on the 4 px grid: `--space-0`, `-1` (4 px), `-2`, `-3`, `-4`,
  `-5`, `-6`, `-8`, `-10`, `-12`, `-16`, `-30` (120 px); the step number times 4 is the px value. Classes use the same
  numbers: `p-*`, `pt-*` / `pr-*` / `pb-*` / `pl-*`, `pv-*` / `ph-*`, `m-*` and its sides and axes, `gap-*`. Margin,
  padding and gap never take raw px or rem. The one exception is a 1–3 px hairline alignment (border compensation, a
  focus offset, an icon nudge), which stays raw. When no step fits, ask for a token.
- **T4 Radius comes from `--radius-*`.** `--radius-base` (4 px), `-lg`, `-xl`, `-2xl`, `-3xl`, `-4xl`, `-full`, or the
  classes `rounded` (base), `rounded-lg` … `rounded-full` and the corner variants `rounded-tl` / `rounded-tr`. Radius
  never comes from the spacing scale. `br-` is the border-right prefix of T1 and never a radius.
- **T5 Type comes from a type role.** New text uses a `type-*` class (the map's `type` group: family, weight, size,
  line height, tracking). Sizes outside a role use `--fs-*` or the `fs-*` classes: `100` (10 px), `150` (11), `200`
  (12), `250` (13), `300` (14), `400` (16), `500` (20), `600` (24), `700` (30). Weights are `fw-300` … `fw-600`: Inter
  carries 300–600, Lexend Deca 300 and 400. Font families are `--font-ui` (Inter, body and controls), `--font-brand`
  (Lexend Deca, titles and navigation) and `--font-mono`. Shadow and overlay come from `--shadow-sm`, `-md`, `-lg`,
  `-down` (plus the CMS-local `-arrow` / `-right` / `-left` / `-top` / `-around`) and `--overlay-backdrop`, `-heavy`,
  `-loading`, `-handy`, `-ripple`. The page `<h1>` carries `.page-title` (`typo/_typo.scss`: `--font-brand`,
  `--fs-700`, 400), so a view never sizes or weighs it; content H1s (rich text, previews, docs) are not page titles and
  keep the browser look; section titles stay Inter 600 one step
  down. Text that carries meaning is at least 12 px (`--fs-200`); 10–11 px is for decorative counters only (a badge
  count on a tab, chip, bell or filter button).
- **T6 Every screen works in both themes.** `data-theme` on `<html>` is `default` (light) or `dark`. A screen that
  follows T1 is themed for free. Scope third-party dark overrides as `[data-theme="dark"] .x { }`.

Removed in P2, and lint fails on them: the old palette (`--c-*` and its `t-` / `bg-` / `b-`… `<colour>-<shade>`
classes), the old spacing steps (`--space-50` … `--space-700` and `p-100`-style classes with their `-m` / `-d`
variants), `--radius-sm` / `--radius-md`, the radius classes `br-<n>`, `br-tl-<n>`, `radius-<name>` and
`br-<radius name>`, `--fs-800` … `--fs-1000`, `fw-100` and `fw-700`.

Traps:
- `ph-*` / `pv-*` are shorthands, and they reset the other two sides. Use `pl-*` + `pr-*` when you also set a vertical side.
- Utility grid classes apply only from 640 px up. Below that, use flex.
- Inputs, selects, number and colour inputs and buttons share `--elem-height` (32 px), so never override it on one of them.

## Components

- **C1 Build UI from boots.** Views, `src/components/` and `src/functionals/` use no raw `<button>`, `<input>`
  (except the hidden `type="file"` picker), `<select>` or `<textarea>`: each is a lint error (a native `<select>` →
  `BasicSelect`). A click handler sits on a boot or a focusable, named element: a click-only `span`/`div` fails `@ux`
  (`nonFocusable`). A decorative icon carries no pointer and no handler (`BasicInput`'s icon is `aria-hidden`).
- **C2 One component, one implementation.** Before writing a component, check `src/boots/` and `src/functionals/`.
  If one does most of the job, extend it with a prop or variant. If it is broken, fix it in place. Never make a
  panel-local copy of a boot or a panel kit of classes. New shared UI goes into `src/boots/` + `register-elems.js`. Builder
  controllers also register in `src/configs/builder/components/register-elems.js`. A removed component is a lint
  error (`scripts/lint/removed-components/*.json`): `Dropdown` → `BasicSelect`, `Switcher` → `BasicSwitch`,
  `TextAreaBasic` → `BasicTextarea`, `LockedField` → `BasicInput readonly`, `ToolTip` / `HelpTooltip` / `HoverMe` →
  `BasicTooltip`, `BackBar` → PageHeader `back`, `Loading` → `Loader`, `PimField` → `FormField`. The removed
  FormField props (`description`, `tooltip`) are a lint error too, matched on the normalised tag name (`<FormField>`
  and `<form-field>`).
- **C3 Do not restyle a boot from outside.** No local `.filter-chip`, `.status-badge`, `.chip` or badge and button
  class families. A missing look is a variant of the boot.
- **C4 Pick the boot by job:**

| Job | Boot |
|---|---|
| single-line text · read-only value · number · colour · rich text | `BasicInput` · `BasicInput readonly` · `NumberInput` · `ColorInput` · `BasicWysiwyg` |
| multi-line text | `BasicTextarea` |
| on/off · one boolean with a text · one of 2–5 choices, all visible | `BasicSwitch` · `BasicCheckbox` (boolean `v-model`, label in the slot) · `BasicRadioGroup` |
| date / range | `BasicDatePicker` (`mode: "range"` in `config`) |
| choice from a list · async entity search · channel scope | `BasicSelect` (`multiple`, `searchable`) · `EntitySearchPicker` · `ChannelMultiSelect`; a `BasicSelect` without a FormField label (a filter row, a toolbar, a card or page header) takes `floatingLabel`, its field name (it hangs above the box without taking layout height, so the select stays level with unlabelled siblings — no per-view `align-items` fix) — except in a PageHeader `meta` row below 1024 px, where it is named by `aria-label` only (any label above it pushes the select off the line of the title and the buttons); the `ChannelMultiSelect` chip names itself („Kanały: Wszystkie”) |
| action picker (a transition, "add an existing item") | `BasicSelect :model-value="null"`, the placeholder as the prompt, the handler on `@update:model-value` |
| field label, hint, required, error, help | `FormField`, around every field |
| status / category pill · value chip (picked entity, media tag) · number next to a title, tab or filter | `StatusBadge` (`tone`) · `Tag` · `CountBadge` |
| card / section container · Home panel tile · media grid tile | `BasicCard` · `PanelCard` · `MediaTile` |
| tabs of one screen · mode switch (list / edit) | `BasicTabs` · `SegmentedControl` (never a pair of chips) |
| filter toggle | `FilterChip`: one chip set inline (one row that scrolls sideways on a phone), more filter groups inside `MobileFilterPanel` |
| list · pages · bulk actions · empty list | `DataTable` · `Pagination` (`v-model:page` + `pages`) · `BulkActionBar` · `EmptyState` |
| loading | `Loader` (`block` in a content area, `overlay` for the whole screen, `overlay contained` in a panel) |
| page frame · page title row (crumbs, back, H1, chips, actions) · breadcrumbs | `PageLayout` · `PageHeader` · `Breadcrumbs` |
| sign-in screen frame · password field | `AuthLayout` · `AuthLayout/PasswordField` |
| text action · icon-only action · page or dialog actions | `BasicButton` · `IconButton` · `ActionBar` |
| side panel · per-language editing | `SideDrawer` · `TranslationsDrawer` |
| dialog · confirmation (yes/no, unsaved changes) | `BasicModal` · `ConfirmDialog` (`tone="danger"` for a delete) |
| a secret shown once (a new API token) | `SecretReveal` (never a toast, a store, the router or a log) |
| action menu or popover panel · a panel of text (configuration health) · floating action (+ labelled pill) | `BasicMenu` · `BasicMenu sheet` (a ≤ 32rem popover, a bottom sheet on a phone) · `FloatingActions` (`pill`) |
| field hint next to a label · tooltip on a control | `FormField hint` + `hintLevel` (else `BasicTooltip variant="help"`) · `BasicTooltip` |

- **C5 One icon set: FontAwesome, picked by meaning.** A template names the meaning, never the glyph:
  `<FontAwesomeIcon :icon="$icons.edit" />` (`src/boots/Icons/icons.js`, keys camelCase). A new meaning adds its glyph
  to `fa-icons.js`, in both the `import` and the `library.add()`: a missing registration renders nothing and logs
  nothing (the registry unit test catches it). The icon font is deleted: an `icon-*` glyph class is a lint error.
  `BasicInput icon`, `BasicButton icon`, `IconButton icon`, `EmptyState icon` and `FloatingActions` icons take a
  meaning of the registry (`icon="search"`) and nothing else.
  Icon policy: a text button carries no icon unless the design shows one. An icon-only action is an `IconButton`
  with `label` (its accessible name: `aria-label` and `title`), and it gets a visible text label when it is
  important or not obvious (R7).
- **C6 One button family.** `BasicButton` owns height, padding, type and border: `size="md"` (default,
  `--elem-height`, the toolbar and form size) or `size="sm"` (row actions); labels never wrap. `size="lg"` (40 px,
  on `BasicButton` and `BasicInput`) is for the sign-in screens only. The role is
  `variant`: `primary` (one per page, R5: row, bulk, section and inline-form actions are `secondary` beside it; a
  dialog or drawer has its own), `secondary`, `ghost` (close, row edit), `danger` (every delete, remove, reject),
  `danger-solid` (the destructive confirm in a dialog: a delete, remove or flush is a `ConfirmDialog tone="danger"`;
  every other confirm is its default primary); without a `variant` it is `secondary`. The label is the default slot.
  An icon-only action is an `IconButton` (`sm` / `md` like the text button,
  `lg` 40 in the header), `variant` `ghost` · `outline` · `primary` · `danger`, `pressed` for a toggle; an icon-only
  `BasicButton` without `label` warns in the dev console. One toolbar uses one size. Back is the PageHeader `back`
  arrow (R3); a back control inside a page (a Settings section's way back to the hub) is `IconButton icon="back"`
  named „Wstecz”. The click stops at the button; inside a wrapper that acts on the click
  (`SubscriberSetter`) pass `:stop="false"`. An icon-only button is named by its short action (`label`), and that is
  its one tooltip (IconButton draws it as a `BasicTooltip`): no tooltip wrapper on top of it.
  Never pass `bg-*` / `t-*` utilities to pick a role, and never set a button height or font size from a view.

## Layout (R1–R9)

- **R1 Navigation on the left.** Every panel and every sub-page can be reached from the persistent left sidebar.
  The header has no panel switcher. To add a page, add its entry to `src/components/Navigation/nav-routes.js`. Never
  hard-code a menu in a view.
- **R2 One page title.** The page title appears once, as the only `<h1>`, at the top of the content area. The
  header, sidebar and toolbar never repeat it. The content area is the page's only scroll and focus region, so the
  app box is the dynamic viewport (`100dvh`, App.vue; a full-screen layer likewise): with 100vh Android's browser
  toolbar never collapses and the tab bar ends up under the system bar. The H1
  is `PageHeader` `title` (the component carries `.page-title`, and `data-fid="page-title"` on its title row); a view writes no raw
  `<h1>`. A route whose view has no PageHeader gets the shell's fallback header (crumbs + H1 from `titleKey`), so
  every page has exactly one H1.
- **R3 Breadcrumbs below the panel root.** Every page below a panel's top-level list shows breadcrumbs
  (`Panel / List / Item`) above the H1, with a back arrow next to the H1. A panel's top-level list has neither.
  `PageHeader` takes `crumbs` and `back`; `Breadcrumbs` renders the trail (last item = the current page, not a link)
  in a `<nav>` named by `common.breadcrumb` — a second, named `navigation` landmark next to the sidebar. PageHeader
  renders a `<header>` inside `<main>`, so it is no banner landmark.
- **R4 Space, not lines.** Header regions and page sections are separated by spacing tokens, never by divider
  lines (`bb-*`, a `border-bottom` under a header or toolbar, `<hr>`). Borders belong to containers: cards, section
  blocks, tables and inputs. The content region is `PageLayout` (no border, no card, padding 40/80, 20 on a phone;
  `roomy` keeps 40/32 and the 30 px title on a phone for the Figma frames: Home, content list, gallery); its `toolbar`
  slot holds the filters row, its `footer` slot a list's Pagination (pinned to the bottom edge while the list
  scrolls). A view never overrides the frame (`:deep(.page-header__title)`, the PageLayout padding or gap, the FAB
  position): a missing look is a prop of PageLayout, PageHeader or FloatingActions.
- **R5 Action order.** Page and dialog actions are right-aligned and ordered by importance from the right. The
  primary action (accent fill, one per page or dialog) is rightmost, the secondary (outline) comes next, then the
  icon-only utilities. Every screen uses the same order: `ActionBar` renders it from the actions' `role`, and on a
  phone takes its own row labelled „Akcje”. Page actions go into PageHeader `actions` as an `ActionBar`: right of
  the title on desktop, own row below 1024 px.
- **R6 One icon, one meaning.** An icon stands for one action across the CMS, and it is never reused for another
  action (reorder `arrows-up-down` ≠ menu `grip` ≠ drag handle `grip-vertical`). Pick the meaning from `$icons`
  (`icons.js`: one glyph per meaning, one meaning per glyph); a literal glyph name in `icon="…"` or inside an `:icon`
  binding is a lint error, and `scripts/codemods/p3-icons.mjs` rewrites it. An icon shows the action it runs (a
  collapsed row shows `expand`, an open one `collapse`). A meaning that is missing is added to
  `icons.js`. Tile-group rows use distinct icons for add, reorder and
  preview.
- **R7 Label important actions.** An action that is important, or not obvious from its icon, carries a visible
  text label. A tooltip alone is not enough. Icon-only is reserved for well-known utilities (close, row delete,
  more), and each one is an `IconButton` with its `label`. A labelled action next to the FAB is its `pill`
  (`FloatingActions`, „Zarządzaj kolejnością”); tools that repeat one icon (rich-text table tools) are text buttons.
- **R8 Brand, not generic.** Accent and interactive states use the brand accent tokens (`accent` for text, icons,
  borders and indicators; `accent-fill` with white text for fills). No generic blue, and no panel-specific colours.
  The primary fill is `bg-accent-fill t-on-accent-fill`.
- **R9 Restyle before restructure.** A visual change keeps the structure and behaviour of a screen unless R1–R8
  require a change. Content-builder section blocks, tiles and `DataTable` internals change through tokens only.
  The builder list mirrors the page on purpose: a section block has two zones that never mix — the section's own
  (`surface-base`: type, tile count, uid, config and actions, then its title as a heading and its other content)
  and the tiles tray (`surface-raised`) with bordered tile cards. A tile card previews its tile (image across the
  card, title, text excerpt); a few tiles share the row, many scroll it. A section narrower than `full_width` is
  inset. Types read by their `config_option` name, never the raw `core_type`. A click on a preview opens its edit
  kit (the pencil stays the keyboard path). Order changes in place by the grip — tiles sideways in their row,
  sections up and down with the trays folded while one is dragged; the order kit stays for keyboard and phone. A
  new section goes in through the "+" between two sections, a new tile through the dashed card that ends the row.

## Page patterns

- **Page frame.** Every view is one `PageLayout` (padding and scroll body): `#header` = the view's `PageHeader` (crumbs,
  back, H1, `meta` chips, `actions`, `description` = the page's help line under the title row, never in `meta`; `tabs`
  = the screen's sections as `RouteTabs`, under the title, the description then under the tabs), a
  loader branch's condition on the slot; `#toolbar` = the search/filter row;
  `#footer` = the Pagination. Page actions are an `ActionBar` in PageHeader `actions` (R5); controls for the whole
  panel (a channel selector) sit in PageHeader `meta` or the ActionBar. An action on a whole store or channel („Tłumacz
  sklep”) lives only in the panel built for it (Translation, as the primary action of its page); a view of one entity
  or a list offers actions scoped to that entity or to the picked rows. A panel wrapper holds no toolbar strip and no
  teleport targets.
- **Read-only page.** `PageLayout` decides it once (the route's `meta.area`, else the panel's first area, without
  write in django-access `me`) and shows one notice line under the header. ActionBar keeps only its utilities (not a
  `danger` one; an action's `mutates` true/false overrides its role), FloatingActions (but its back button) and
  BulkActionBar are gone, and every control boot is disabled, in a FormField or not (a switch or select that saves on
  change too). The PageLayout toolbar and the PageHeader `meta` (search, filters, the channel picker) stay enabled:
  they read, never write. A control elsewhere that only reads or navigates (a search box in a card, a mode switch, a
  list toggle) sits in `ReadonlyOff`. Any other button that creates, changes or deletes (a row's delete, an inline save) is a `BasicButton` or
  `IconButton` with `mutates`; one whose POST only reads (a lookup, a preview, a validation) says `:mutates="false"`.
  A `draggable`, a drop zone or a file input binds the flag itself (`:disabled="readonly"`, `v-if="!readonly"`; a view
  reads its own page's flag with `usePageReadonly()`, a component inside the page with `useReadonly()`). A tab that
  embeds another panel's screen (a product's prices, stock, supplier) sits in `ReadonlyArea :area` and is shown only
  when that area is readable. `npm run audit:readonly` (part of `lint:ui`) fails on a write control the mode does not
  reach. A view never checks write permission itself for this; `:readonly` on PageLayout forces it on, never off.
- **Floating action.** `FloatingActions` sits 24 px from the bottom-right corner beside the sidebar (Figma S4) and
  16 px from the edge above the tab bar below 1024 px; a view never moves it. Bottom-pinned rows (the PageLayout
  footer, a sticky decision bar) keep the FAB's corner clear through `--fab-lane`.
- **List view.** The toolbar holds a search `BasicInput` with `useSearchDebounce`, then the filters, and it wraps.
  Filters: one chip set is an inline `FilterChip` row (it scrolls sideways on a phone); more than one filter group
  goes into `MobileFilterPanel`; a filter select is a `BasicSelect` with `floatingLabel`. The row wraps (`flex-wrap`, `gap: var(--space-5)`); below 768 px the search (the row's first control) takes the whole row and the filters line up under it (PageLayout sets it — a view never sizes its search for a phone). In `DataTable`, secondary columns get fixed
  widths and only the primary text column gets `1fr`, truncated with an ellipsis. A cell either fits (its column
  grows to the badge or buttons) or truncates with a `title`, never spills into its neighbour; a status badge column
  is `max-content`, never truncated; numbers take
  `numeric`, row buttons `actions`, and every column but name, status and actions takes a `priority` so a phone
  shows those three. A raw table uses `.table-basic` in a `.table-scroll` box. No data means `EmptyState`
  (`DataTable` renders it from `emptyText`, below the grid so a phone sees it); never a plain muted paragraph. A table
  inside a detail screen keeps the one-line empty state (`DataTable` default); a list screen whose only content is
  the table passes `empty-size="md"`.
- **Loading.** A screen whose data arrives after first paint shows `<Loader block v-if="loading" />` in the content
  area (`block` centres it; a loader in a modal, side panel or button stays inline, without `block`), and actions that need the data (Save, Delete) render only after the load. The empty
  state comes after the load, never during it. A record that answers 404 shows `EmptyState` with a way back, not a
  blank form.
- **Values.** Show a stored value in the unit people read (a tax rate fraction `0.2300` is "23 %",
  `src/utils/taxRate.js`); a field takes the same unit and converts on save. Dates and times go through `formatDate`
  (`src/utils/format.js`), never raw ISO. A select in an edit form shows the stored value even when the loaded
  options lack it (`withStoredOption`, `src/utils/options.js`).
- **Edit view.** A `FormField` wraps every field, validation follows § Forms, and there is one primary Save (R5).
  A dirty form shows the unsaved state next to the actions. Rhythm: 16 px (`--space-4`) between fields, 24 px
  (`--space-6`) between groups, 32 px (`--space-8`) between cards.
- **Cards.** `BasicCard` is the one card (a section card, a modal surface, an auth card): `surface-base`,
  `border-subtle`, `--radius-3xl`, 24 px padding, 16 px below tablet, from `.page-card` (`utils/_decorators.scss`),
  which only `BasicCard` renders. A page is no card (R4). A view never sets its own card padding, border or radius.
- **Dialogs.** Build on `BasicModal` (`size` sm · md · lg) or `ConfirmDialog`, never an overlay of the view's own:
  they trap focus, close on Esc and give focus back, and turn into a bottom sheet on a phone. Actions go in the
  footer as an `ActionBar` (R5). A dialog with an async action closes on success and on error — but a refusal that
  names one of its fields (a create dialog's 400 or 409) keeps it open with the error on that field.
- **Locked / system entity.** Show a notice bar at the top. Pass `disabled` to each boot (or to the `FormField`), or
  show the value as `BasicInput readonly`. Disabled controls share one look (`--surface-disabled`, `--border-subtle`,
  muted text).
  Hide delete. Save stays for the fields that are not locked.
- **Disabled button with a reason.** Wrap the disabled `BasicButton` in `BasicTooltip` carrying the reason (the
  wrapper becomes the tab stop, so the reason reads on keyboard focus too), and put the live button in the `v-else`
  branch.
- **Delete.** Use an `IconButton variant="danger" icon="delete"`, followed by a confirmation. Never a text "Delete" button.
- **Drag and drop.** Use `vuedraggable` with `:force-fallback="true"` and `fallback-class="drag-ghost"`. The ghost
  style goes in an unscoped `<style>`, because the clone is appended to `<body>`.

## Forms

- Create `useFormErrors()` in `setup()` and return it as `formErrors`.
- A detail screen follows the detail-form pattern (`docs/ui-components.md` § Detail form): `BasicCard` sections with a
  `title`, a `.form-grid` of FormFields inside (2 columns above 768 px, `.form-grid__wide` spans both), the page's
  actions in PageHeader `actions`. No view-local `detail-*` layout classes.
- A field is built one way: `<FormField label hint hint-level required error>` around one control. FormField
  owns the label, hint, error and required marker; the control never carries its own label or error text. It takes `v-model`
  and `disabled` (never `isDisabled`, `is_disabled`, `prevent`). `layout="inline"` for a toolbar field (label left of
  the control from 1024 px). The error is `:error="formErrors.getFieldError('field')?.msg || ''"` on the FormField.
- One hint pattern: `hint` shows a `?` after the label that opens the text on hover, keyboard focus or a tap.
  `hintLevel="important"` (filled) when the hint holds a constraint, a format, a limit or a consequence („nie można
  zmienić po zapisie”, „0 = bez limitu”); `subtle` (hollow, the default) for everything else. No caption paragraph
  under a field, no `description` / `tooltip` (removed, lint). The error replaces the hint in `aria-describedby`.
- Hints are optional help: users can turn them off in the account menu. Never put information a user must see only
  in a hint — a state that blocks the form („brak języków”) or a live value is content, shown under the control.
  A note that explains a disabled or empty control (TranslateDialog „no languages”) is visible, has an
  id and is linked from the control's `aria-describedby`, where it joins the field's own description (BasicSelect
  and BasicInput merge them: `"<field id> <caller id>"`).
- One label style: `FormField` renders `.field-label` —
  12 px / 600, uppercase, `text-muted`, 4 px above the control. A raw `<label>` takes `.field-label`; never a local
  copy of the style. The required marker is the `.required` class (a `negative` `*` after the label), never a `*`
  typed into the text.
- A value whose format matters takes BasicInput `format` (`src/utils/formats.js`: `money`, `percent`, `integer`,
  `ean`, `code`, `key`, `slug`, `email`, `url`, `iso2`, `iso4217`) and the API `maxlength`: the field shows the
  format (a price „232,00”), fills the model in the API's type as it is typed (`232` → `"232.00"`) and marks a wrong
  value when it is left. Never round or correct into another value (`2,345` for money is an error). An existing
  record checks only the formatted values the operator changed — a stored legacy value never blocks other edits.
- Run `validateRequired(form, rules)` and then `validateFormats(form, rules)` (`{ field: { format, min, max, pattern }
  }`) before the request, and `formErrors.handleApiError(err)` in `catch`, before the toast.
- A deep watcher on the form clears the errors when the user edits. Never show a generic toast only.
- On the sign-in screens an error goes under its field and into the `AuthLayout` `status` summary, never a toast.

## Mobile

- The shell switches at one breakpoint, 1024 px: `SHELL_BREAKPOINT` in `src/utils/breakpoints.js`, `$breakpoint-shell`
  and the `max-shell` mixin in `utils/_media-query.scss` (a unit test holds them together), `useIsDesktop` in script.
  From it up the sidebar, below it the header menu button, the mobile menu and the tab bar.
- Breakpoints come from the mixins, never from raw media queries. Check every screen at 390 px (one thumb) and on
  desktop. The page never scrolls horizontally, and neither does a card: a wide table (`DataTable`, or a raw table in
  an `overflow-x: auto` box), `BasicTabs` and `SegmentedControl` scroll inside their own box.
- Rows wrap instead of overflowing: `PageHeader` wraps its actions under the title, right-aligned (R5); other rows use
  `.flex-wrap` (with `.rg-*` for the row gap); form rows stack to one column below tablet. A row switches at one
  breakpoint (`max-tablet` or `max-shell`), never at both.
- `BasicCard` pads 16 px below tablet; `PageLayout` pads 20 px. Spacing utilities (`p-12` …) mean the same on every screen; an empty state or loader keeps its own. The
  layout keeps every scroll region above the bottom bar.
- A tap target is at least 40 × 40 px on mobile, and list rows are at least 36 px high. A small control keeps its
  visual and takes the `touch-target` mixin (`utils/_touch-target.scss`): a transparent `::after` hit area, below
  tablet only. Hit areas never overlap: where a neighbour is closer, the area is the control plus half the gap on
  each side (the help "?" above its field, wrapped filter chips, table rows).
- Focus is visible and calm. Buttons, tabs, links and other non-field controls get the global 2 px `--accent`
  outline at a 2 px offset. Text fields (`input`, `textarea`, `select`) mark focus on the field: `--accent` border
  plus a 2 px glow at 30 % (`utils/_reset.scss`), no outline, no extra halo — not even on the sign-in screen.
- A control in a scrolling box (`BasicTabs`, `SegmentedControl`) draws its focus ring inside (`outline-offset:
  -2px`), so the box never clips it.
- A button with icon + text drops its text on mobile via `icon-only-mobile`. It keeps an accessible label. The page's
  primary actions (Save, Publish, Approve) keep their text (R7).
- Fixed-bottom elements sit above `var(--bottom-bar-height)`.

## Copy

- Every visible string goes through `$t()`, with keys in both `src/i18n/locales/en.json` and `pl.json`. There is
  no `$tc`: format counts into the string.
- A loading message starts with "Ładowanie" / "Loading" and ends in an ellipsis ("Ładowanie…"); a permanent label
  never does. The visual harness waits on exactly that shape before it captures a screen (`docs/testing.md`).
- Polish copy uses full diacritics (`ą ę ć ł ń ó ś ź ż`). Labels on actions are verbs ("Zapisz szkic").

## Designs

Figma file `jimkqs9e4FejL8MzIv3mq1`, frozen at version `2401775257004070120`, is the layout and structure reference
for the 2026 redesign only. Values never come from Figma. Map every Figma value to the nearest token, or ask for a
token when none fits. The fidelity harness keeps the list of decided differences. A screen without a design is built
from this file and the catalogue page. The designer updates Figma afterwards, and that update is never a blocker.

## Before merge

1. `npm run lint:ui` passes: every UI rule is an error, and a rule that is wrong for a real case gets a narrow,
   commented exception in `eslint.config.mjs` / `stylelint.config.mjs`, never an inline disable.
2. `npm run test:unit` and `npm run test:smoke` pass.
3. You checked the screen in both themes, at 390 px and on desktop.
4. `@parity` (token resolution, the census of every capture-spec screen) and `@landmarks` are green
   (`docs/testing.md` § Visual fidelity harness).
5. `npm run visual:ux` is green: no `high` finding. `tests/visual/ux-allow.json` is empty; an entry names its owning
   plan and the reason.
6. A boot you added or changed has its cells on `/ui` and `npm run visual:catalogue` is green.
