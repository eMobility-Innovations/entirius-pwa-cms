// `@ux` guard allow-list (tests/visual/ux-allow.json): a known, deliberate `high` finding that a named later plan
// owns. An entry matches an issue of its kind on its screen (or "*": every screen) and viewport (omitted: both) whose
// element — the last step of the issue's selector, not an ancestor — contains the entry's `selector`. Empty is the
// target.
const REQUIRED = ["screen", "kind", "selector", "reason", "owner"];

function checkEntries(entries) {
  const invalid = entries.find((entry) => REQUIRED.some((key) => !entry[key]));
  if (invalid) throw new Error(`ux-allow.json: every entry needs ${REQUIRED.join(", ")} — ${JSON.stringify(invalid)}`);
  return entries;
}

const matches = (entry, { screen, viewport }, issue) =>
  [screen, "*"].includes(entry.screen) &&
  (!entry.viewport || entry.viewport === viewport) &&
  entry.kind === issue.kind &&
  issue.selector.split(" > ").at(-1).includes(entry.selector);

// The `high` issues of a screen report that no entry allows: the guard fails the screen × viewport on any of them.
function blockingIssues(report, entries) {
  checkEntries(entries);
  return report.issues.filter((issue) => issue.severity === "high" && !entries.some((entry) => matches(entry, report, issue)));
}

module.exports = { blockingIssues };
