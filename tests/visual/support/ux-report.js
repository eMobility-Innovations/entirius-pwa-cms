const fs = require("fs");
const path = require("path");
const { REPORT_DIR, writeReport } = require("./report");
const { screens } = require("../capture-spec.json");

// `@ux` report (docs/testing.md → "UX checks"). Later plans gate on the summary shape: keep it stable.
const KINDS = ["zeroSize", "offViewport", "underBottomBar", "nonFocusable", "overlap", "overflow", "tapTarget"];
const HIGH = new Set(["zeroSize", "offViewport", "underBottomBar", "nonFocusable"]);
const METRICS = ["height", "paddingX", "radius", "fontSize", "border"];
const UX_DIR = path.join(REPORT_DIR, "ux");
const RUNS_DIR = path.join(UX_DIR, "runs");
const SUMMARY = "ux-summary.json";

const severityOf = (kind) => (HIGH.has(kind) ? "high" : "medium");
const countByKind = (issues) =>
  Object.fromEntries(KINDS.map((kind) => [kind, issues.filter((item) => item.kind === kind).length]));
const sortValues = (values) =>
  values.sort((a, b) => parseFloat(a) - parseFloat(b) || String(a).localeCompare(String(b)));
const sortKeys = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));

// measured = window.uxProbes.measure() → { issues, buttons, labels, cards, bottomBar }, { error } when the screen
// did not open, or { skipReason } when the seed has no data for it.
function screenReport({ screen, viewport, runId, measured }) {
  const empty = { issues: [], buttons: [], labels: [], cards: [] };
  if (measured.skipReason) return { runId, screen, viewport, skipped: measured.skipReason, counts: countByKind([]), ...empty };
  if (measured.error) return { runId, screen, viewport, error: measured.error, counts: countByKind([]), ...empty };
  const issues = measured.issues.map((item) => ({ ...item, severity: severityOf(item.kind) }));
  const { buttons, bottomBar, labels = [], cards = [] } = measured;
  return { runId, screen, viewport, counts: countByKind(issues), bottomBar, issues, buttons, labels, cards };
}

// { <role>: { <metric>: [distinct values] } } over every button of every screen.
function distinctMetrics(buttons) {
  const roles = {};
  for (const button of buttons) {
    roles[button.role] ||= Object.fromEntries(METRICS.map((metric) => [metric, new Set()]));
    METRICS.forEach((metric) => roles[button.role][metric].add(button[metric]));
  }
  const listed = (sets) => Object.fromEntries(METRICS.map((metric) => [metric, sortValues([...sets[metric]])]));
  return sortKeys(Object.fromEntries(Object.entries(roles).map(([role, sets]) => [role, listed(sets)])));
}

// { <value>: { desktop: <screens>, mobile: <screens> } }: on how many screens each distinct value appears.
function screensPerValue(reports, pick) {
  const values = {};
  for (const report of reports) {
    for (const value of new Set(pick(report))) {
      values[value] ||= { desktop: 0, mobile: 0 };
      values[value][report.viewport] += 1;
    }
  }
  return sortKeys(values);
}

function buildSummary(reports, runId) {
  const totals = Object.fromEntries(KINDS.map((kind) => [kind, { desktop: 0, mobile: 0 }]));
  const screens = {};
  const errors = {};
  const skipped = {};
  for (const report of reports) {
    const key = `${report.screen}__${report.viewport}`;
    if (report.skipped) {
      skipped[key] = report.skipped;
      continue;
    }
    screens[key] = report.counts;
    if (report.error) errors[key] = report.error;
    KINDS.forEach((kind) => (totals[kind][report.viewport] += report.counts[kind]));
  }
  const severity = Object.fromEntries(KINDS.map((kind) => [kind, severityOf(kind)]));
  const buttonMetrics = distinctMetrics(reports.flatMap((report) => report.buttons));
  const labelStyles = screensPerValue(reports, (report) => (report.labels || []).map((label) => label.style));
  const cardPaddings = screensPerValue(reports, (report) => (report.cards || []).map((card) => card.padding));
  const census = { buttonMetrics, labelStyles, cardPaddings };
  return { runId, totals, severity, screens: sortKeys(screens), ...census, errors: sortKeys(errors), skipped: sortKeys(skipped) };
}

// Every run writes to its own folder, runs/<runId>/. A full run (every capture-spec screen × viewport measured, skipped
// or failed) replaces the report in ux/ itself and prunes runs/; a partial run (`--grep`) stays in its folder, so it
// never wipes the last full report.
const runDir = (runId) => path.join(RUNS_DIR, runId.replace(/[^\w.-]/g, "-"));
const jsonFiles = (dir) => fs.readdirSync(dir).filter((file) => file.endsWith(".json") && file !== SUMMARY);
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const runReports = (runId) =>
  fs.existsSync(runDir(runId)) ? jsonFiles(runDir(runId)).map((file) => readJson(path.join(runDir(runId), file))) : [];

function writeSummary(runId) {
  const file = path.join(runDir(runId), SUMMARY);
  writeReport(path.relative(REPORT_DIR, file), buildSummary(runReports(runId), runId));
}

// Rewrites the run's summary after every screen, so a crashed worker never loses the screens measured before it.
function writeScreenReport(input) {
  const report = screenReport(input);
  writeReport(path.relative(REPORT_DIR, path.join(runDir(report.runId), `${report.screen}__${report.viewport}.json`)), report);
  writeSummary(report.runId);
  return report;
}

function promote(runId) {
  jsonFiles(UX_DIR).concat(SUMMARY).forEach((file) => fs.rmSync(path.join(UX_DIR, file), { force: true }));
  fs.readdirSync(runDir(runId)).forEach((file) => fs.copyFileSync(path.join(runDir(runId), file), path.join(UX_DIR, file)));
  fs.rmSync(RUNS_DIR, { recursive: true, force: true });
}

const specKeys = () => screens.flatMap((screen) => screen.viewports.map((viewport) => `${screen.id}__${viewport}`));

// Parallel workers rewrite the summary concurrently, so the last rewrite can miss a screen another worker wrote in
// the meantime: global-teardown rebuilds it once from every screen of the run, then promotes a full run. A run
// without @ux screens (parity, screens) leaves the folder untouched. → { measured, full }
function finishRun(runId, expected = specKeys()) {
  const reports = runId ? runReports(runId) : [];
  if (!reports.length) return { measured: false, full: false };
  writeSummary(runId);
  const done = new Set(reports.map((report) => `${report.screen}__${report.viewport}`));
  const full = expected.every((key) => done.has(key));
  if (full) promote(runId);
  return { measured: true, full };
}

module.exports = { KINDS, HIGH, screenReport, buildSummary, writeScreenReport, finishRun };
