# Leads panel

Salesperson screens for django-leads + django-communicator, mobile first (one thumb at 390 px), desktop =
same screens in two columns (`src/views/Leads/index.vue`, CSS grid only). One panel for both backends (there is no
Communicator panel): munin keys `leads` and `communicator` both map to it, and every nav entry, route and
Settings section carries the module it needs (`requiresModule` / `meta.module` / the hub's filter) — a section of
a module that is off is simply not there. Nav: Inbox · Pipeline (`/leads/board`) · Import (leads) · Settings; a phone gets Inbox · Settings in the bottom bar, which Review
(`meta.noBottomBar`) keeps off its sticky actions. Inbox is one entry for two lists: the left column carries a
`SegmentedControl` Conversations | Companies (`leads-list-toggle`, shown with both modules) that only navigates
`/leads/inbox` ↔ `/leads/companies`; a card, draft or thread opened from a list keeps that list in the column, and
the entry stays lit on all of them (`activeOn`). Without communicator there is no Inbox and no toggle: the
Companies entry (`hiddenWithModule: "communicator"`) opens the company list full width. `siteintel` (intel card) and `notifications` (header bell, `src/components/NotificationBar/`)
gate in-view with `isModuleEnabled` — never map them in `MODULE_TO_PANEL`. Every leads-family call takes the
channel from `src/stores/leadsChannel.js` (`VUE_APP_LEADS_CHANNEL`, default `default-europe`), never
`VUE_APP_CHANNEL`. Review has no detail endpoint: the view finds the draft in `review/?status=review_required`.
The thread view opens the newest thread of `leads.Company:<id>` (closed or not); older threads sit behind one "Earlier threads" expander (first `threads/` page, more pages on demand, a row's detail loads with the row so its subject and recipient are readable collapsed) that badges an undecided opt-out; a reply that landed before our newest mail expands that section and opens its thread. A reply that sits in an older thread is marked ("The reply is in this thread") and scrolled into view on arrival (the bell carries only `subject_ref`). A waiting bubble shows no clock of its own: it states `sendState(next_slot)` like the Inbox (`src/utils/leadsTime.js`); a reply's quoted history (from its first `>` line) folds behind a toggle. `/leads/inbox` is one list of every conversation of the channel — one row per `subject_ref` (a company, or any other ref), never one per technical thread (`conversations/`: the newest thread's row, state/draft/waiting/reply from any of its threads, `thread_count > 1` as a quiet "N threads" hint; 20 per page, a 30 s poll like the bell) behind four `FilterChip`s whose counts come with the list (`counts`): All · Drafts · Waiting · Replies — Drafts is the default while drafts wait. A row keeps one layout and one marker (`InboxRow.vue`; the chip decides it for a conversation in several states): a draft opens Review (the row's draft, even from an older thread, "To:" its own recipient), a waiting mail shows a clock + `sendState(next_slot)` and Send now while `canSendNow`, a reply its first own line. Other rows open the company card, and a conversation without a company opens its newest thread at `/leads/conversations/:id`. The bell falls back to that view for an unmapped `subject_ref`. The empty Drafts filter keeps the old empty state ("N scheduled, <state>", `inbox-empty`), and the chip bar is `inbox-summary` — both are the emporium `InboxPage` contract. Activity messages are service strings — `activityText` (`src/utils/leadsLabels.js`) turns the known shapes into sentences. Config problems of the screen
(outgoing SMTP) show as `ConfigBanner code="…"` and the AI toolbox state as `AiToolboxHint` (`src/components/ConfigHealth/`),
both fed by the store `configHealth` — see `docs/config-health.md`. `data-testid`s are the contract of the
emporium page objects (`src/entirius_tests/cms_pages/`) — rename both together.

Desktop screens (≥ 1024 px; below that `DesktopOnly.vue` shows "Open on a desktop"): `/leads/board` (stage columns,
drag or the card's stage select → `companies/<id>/transition/`, refused move snaps back; rule badges from
`GET rules/` — the stages payload carries none), `/leads/import` (`POST imports/`, polls the batch).
Settings (`meta.page`: full width, one scroller, no DesktopOnly wall; every section on PageLayout + PageHeader, its tables DataTables):
`/leads/settings` lists the sections, each its own route — `settings/stages` (reorder = `PATCH stages/<id>/ {order}`
per moved stage — there is no bulk order endpoint; delete 409 inline), `settings/templates` (+ `/:id`),
`settings/sequences`, `settings/sending`, `settings/lead-types` (the Stages pattern: rename, reorder by PATCH `order`, deactivate, delete 409 inline; the code is fixed after create); a section leads back to the hub (the PageHeader `back`; a template goes back to the template list). Lead types are one list for the whole panel — `src/stores/leadTypes.js` (loaded once — a failed load is retried, logout resets it in `App.vue` together with the Inbox company-name cache `src/utils/leadsCompanyNames.js` — `label(code)`, `UNKNOWN` built in): Board chips = the active types in order, the company card's type select, the add-lead form and the template Audience (list column + edit select, shown only with the `leads` module; an audience a communicator does not send is never sent back). `/communicator/*` and `/leads/stages`
redirect there; the route names (`CommunicatorTemplates`, `CommunicatorSettings`, `LeadsStages`, …) did not change. `/leads/companies/:id` on desktop is the company card (`Company.vue`, tabs via `?tab=`
overview | intel | contacts | timeline; timeline = the thread view, which a phone still gets alone);
notification jumps open `?tab=timeline`.
The Contacts tab (`tabs/ContactsTab.vue`) adds, edits and removes contacts — one form at a time, above the
contacts DataTable — with the primary star (one per company, server-side); the fields are `ContactFields.vue`, shared with the add-lead form. Remove
answers 204 (never used, deleted) or 200 (used, anonymised) and the status line says which; anonymised rows are history only.

## Communicator sections of Settings

Template edit sends `auto_approve` back unchanged (Grappelli-only), test-generate
never saves. `GET templates/` is unpaginated (every template of the channel in `results`) and takes no `is_active`
filter, so the Communicate modal filters the full list client-side. Settings: mail footer per language (`SettingsFooter.vue`: HTML around `{{ legal }}` — the agreements text at send time; the server sanitises on save and answers with the cleaned HTML, which goes back into the field; languages = footers + template languages; preview in an empty-sandbox `<iframe srcdoc>` with a sample legal text; no footer = the legal text alone), send policy (holiday country is set
per channel — the SendPolicy API has no country field, so it is read-only here), channel mode (`PATCH channel/` never carries `live_enabled`; sandbox needs a
mailbox), suppressions, waiting messages (`approved` + `scheduled`) with Send now =
`messages/<id>/send-now/` (moves `scheduled_at` only; a mail already at the channel clock cannot be pulled
any earlier, so it offers no second Send now — a reload keeps that). The departure column is a state, never a
clock that slides: `sendState` (`src/utils/leadsTime.js`) names an hour only for a `next_slot` in the future,
else it says due / daily cap reached / waiting for the window with its hours; a used-up cap wins over any slot and
a closed window (policy `windows`, channel time zone) never shows a clock. `next_slot` (outbox endpoint, `GET_WaitingMessages`)
is the one slot the Inbox rows, the Review confirmation (looked up after accept), the thread bubbles and this table all read, so no two screens disagree. The waiting table (DataTable, the recipient under the company) keeps Send now inside the card at 1280 px with the sidebar open; `scheduled-row` + `data-message` sit on the row through DataTable `rowAttrs`. Sequences: create (no step edit API) + the text pool: add, edit in place through the row's edit square (future follow-ups only), remove — a text a thread already got is deactivated, not deleted (DELETE answers 200 with the row instead of 204), listed dimmed with Restore (`TextPool.vue`).
