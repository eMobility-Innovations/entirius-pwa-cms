const fs = require("fs");
const path = require("path");

// Report-mode layers (census, fonts, contrast, landmarks) write JSON here; the HTML report goes to `html/`.
const REPORT_DIR = path.resolve(
  process.env.VISUAL_REPORT_DIR || path.join(__dirname, "..", ".report")
);

// Write-then-rename: a parallel worker reading the folder never sees a half-written file.
function writeReport(name, data) {
  const file = path.join(REPORT_DIR, name);
  const temp = `${file}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(temp, file);
  return file;
}

// Adds one entry per test, so a failed test (a fresh worker) never drops the entries written before it.
// Entries of an earlier run (another VISUAL_RUN_ID, set by global-setup.js) are dropped.
function mergeReport(name, key, value) {
  const file = path.join(REPORT_DIR, name);
  const runId = process.env.VISUAL_RUN_ID;
  const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const entries = current.runId === runId ? current.entries : {};
  return writeReport(name, { runId, entries: { ...entries, [key]: value } });
}

module.exports = { REPORT_DIR, writeReport, mergeReport };
