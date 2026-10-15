# Configuration health

`src/stores/configHealth.js` polls munin `GET health/` (admin-only, 30 s, like the bell) while `munin.loaded`, the
`munin` module is on and the user can read `munin.config` (django-access); "Check again" = `POST health/check/` (adds the live probes). State, not events: nothing is
marked read, a fixed config clears on the next poll. The header triangle (`ConfigHealthButton.vue`, next to the bell)
exists only while a check fails — plus ~10 s of green "fixed" after a bad → good flip; the user menu always opens the
panel (green grid on demand). Text lives once in `config_health.checks.<code with _>.<state>` (`{scope}` = channel),
read by panel and `ConfigBanner`; an unknown code falls back to the backend `title`. `fix_url` starting with `/` is a
router link, anything else opens in a new tab. Probe failures (rows with `probe: true`, from "Check again") stay
until the next "Check again" — a plain poll never repeats a probe. Needs django-munin with `health/` (the release
after 2.1.0): against 2.1.0 the poll 404s quietly. The new munin still sends the deprecated
`platform.toolbox_status` (removed in 3.0.0), so an older CMS keeps working against it.

A row in state `disabled` (the AI toolbox switched off on purpose) is healthy and visible: it sits in the passing
list as "switched off", never shows the header icon, never counts and never flashes "fixed" (`QUIET_STATES`).

AI actions follow one value, `configHealth.aiState`: the `toolbox.status` health row first; without one (health is
read only with `munin.config`, or it is unavailable) the public registry's `platform.toolbox.state`, which
`munin.fetchModules` keeps in `munin.platform`; `""` when neither reports it (an older munin). `aiUsable` is false
for `disabled` and `unconfigured`: Review's Rewrite, the translate dialog's Estimate, and an AI template's model list
and test generate are off; `unreachable` leaves them on, since the toolbox may answer again. `AiToolboxHint` (no
props) is the one place for the hint, with one text per state in `config_health.checks.toolbox_status.<state>`:
Review, the company card and thread, the Communicate dialog, an AI template, the translate dialog and the PIM "AI"
menu (product detail, list selection — `useAiWorkers`, dormant without the `enrichment` module). A new AI
action reads `aiUsable` and renders the hint, never its own state check or text.

The company profile adds one row of its own, read from django-enrichment, not munin: `src/stores/enrichmentProfile.js`
polls `GET profile/status/` (the whole company) and counts the active `rule_suggestion` / `fact_suggestion` memory
entries (60 s) while the `enrichment` module is on and the user can read `enrichment.profile` (App.vue). Its row
(`enrichment.profile`, state `incomplete` or `configured`, `scope` = the missing sections, fix `/enrichment/settings/profile`)
joins the munin rows in `failing` / `passing`; text in `config_health.checks.enrichment_profile.incomplete`. The
suggestions count is the badge of the Enricher Settings nav entry and of its Memory tab (`badge: "memorySuggestions"` in
`nav-routes.js`, `useNavCounts` in `useNav`). The profile and memory pages call `refresh()` after a change.
