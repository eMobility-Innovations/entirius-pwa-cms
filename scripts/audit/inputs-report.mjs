// Input audit, report (plan 61a): the JSON result as markdown — counts per class and mismatch kind, one table per
// panel, then the unresolved joins and the api functions whose path the schema does not know.
const KINDS = {
  "api-only": "API constrains, the CMS does not",
  "cms-different": "CMS stricter or different than the API",
  "display-format": "shown in another format than stored",
};

const cell = (text) => String(text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const countBy = (items, key) => items.reduce((out, item) => ({ ...out, [key(item)]: (out[key(item)] || 0) + 1 }), {});
const sorted = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

function apiText(input) {
  if (input.join.status !== "resolved") return `unresolved: ${input.join.reason}`;
  const { type, format, pattern, maxLength, minimum, maximum, places, enum: values } = input.join.api;
  const parts = [format || type, places != null && `${places} places`, maxLength && `max ${maxLength}`,
    minimum !== undefined && `≥ ${minimum}`, maximum !== undefined && `≤ ${maximum}`, pattern && `\`${pattern}\``,
    values && `enum ${values.length}`];
  const scope = input.join.scope === "file" ? "" : ` — via the ${input.join.scope} calls, a name match`;
  return `${parts.filter(Boolean).join(", ")} (\`${input.join.field}\`${scope})`;
}

function cmsText(input) {
  const { required, serverErrors, ...props } = input.cms;
  const parts = Object.entries(props).map(([name, value]) => `${name}=${value}`);
  if (required) parts.push("required");
  if (serverErrors) parts.push("server errors");
  return [input.component, ...parts].join(" ");
}

function row(input) {
  const field = `${input.label || "(no label)"} · \`${input.model || "—"}\` · ${input.file.split("/").pop()}:${input.line}`;
  const mismatch = input.mismatches.map((m) => `${m.kind}: ${m.detail}`).join("; ") || "—";
  return `| ${[field, input.class, apiText(input), cmsText(input), mismatch, input.proposed].map(cell).join(" | ")} |`;
}

function summary(inputs) {
  const all = inputs.flatMap((i) => i.mismatches);
  const resolved = inputs.filter((i) => i.join.status === "resolved").length;
  const lines = [`${inputs.length} inputs · ${resolved} joined to an API field · ${inputs.length - resolved} unresolved · ` +
    `${inputs.filter((i) => i.mismatches.length).length} with a mismatch (${all.length} mismatches)`, ""];
  lines.push("| Class | Inputs | Joined | With a mismatch |", "|---|---|---|---|");
  for (const [cls, n] of sorted(countBy(inputs, (i) => i.class))) {
    const ofClass = inputs.filter((i) => i.class === cls);
    lines.push(`| ${cls} | ${n} | ${ofClass.filter((i) => i.join.status === "resolved").length} | ${ofClass.filter((i) => i.mismatches.length).length} |`);
  }
  lines.push("", "| Mismatch kind | Meaning | Count |", "|---|---|---|");
  for (const [kind, meaning] of Object.entries(KINDS)) lines.push(`| ${kind} | ${meaning} | ${all.filter((m) => m.kind === kind).length} |`);
  return lines;
}

function panelSection(panel, inputs) {
  const joined = inputs.filter((i) => i.join.status === "resolved").length;
  return [`### ${panel}`, "", `${inputs.length} inputs · ${joined} joined · ${inputs.filter((i) => i.mismatches.length).length} with a mismatch`, "",
    "| Field (label · model · file:line) | Class | API constraint | CMS today | Mismatch | Proposed format |",
    "|---|---|---|---|---|---|", ...inputs.map(row), ""];
}

function unresolvedSection(inputs) {
  const open = inputs.filter((i) => i.join.status !== "resolved");
  const lines = ["## Unresolved joins", "", `${open.length} inputs — listed, not guessed.`, ""];
  for (const [kind, n] of sorted(countBy(open, (i) => i.join.kind))) lines.push(`- ${kind}: ${n}`);
  lines.push("", "| Input | Reason | Candidates |", "|---|---|---|");
  for (const i of open) lines.push(`| ${cell(`${i.file}:${i.line} \`${i.model || "—"}\``)} | ${cell(i.join.reason)} | ${cell((i.join.candidates || []).join("; ") || "—")} |`);
  return lines;
}

function undocumentedSection(inputs) {
  const calls = countBy(inputs.flatMap((i) => i.join.calls || []), (call) => call);
  if (!Object.keys(calls).length) return [];
  return ["", "## Write endpoints without a documented request body", "",
    "The CMS sends a payload, the OpenAPI schema describes none — the service owes a request schema before plan 61 can",
    "take the formats from it.", "", "| Endpoint | Inputs |", "|---|---|", ...sorted(calls).map(([call, n]) => `| ${call} | ${n} |`)];
}

function unmatchedSection(unmatched) {
  const entries = Object.entries(unmatched);
  if (!entries.length) return [];
  return ["", "## API functions the schema does not know", "", "Imported by a scanned file; their path matches no OpenAPI operation.", "",
    ...entries.map(([name, call]) => `- \`${name}\` — ${call}`)];
}

/** The markdown report of one audit result. */
export function renderReport(result) {
  const byPanel = {};
  for (const input of result.inputs) (byPanel[input.panel] ??= []).push(input);
  return [
    "# CMS input format audit", "",
    `Generated by \`scripts/audit/inputs.mjs\` (plan 61a) from the CMS code and the OpenAPI ${result.openapi} schema at`,
    `\`${result.schema}\`. Re-run it rather than editing this file. Plan 61 implements the proposed formats.`, "",
    "## Summary", "", ...summary(result.inputs), "",
    "## Per panel", "", ...Object.keys(byPanel).sort().flatMap((panel) => panelSection(panel, byPanel[panel])),
    ...unresolvedSection(result.inputs), ...undocumentedSection(result.inputs), ...unmatchedSection(result.unmatchedEndpoints), "",
  ].join("\n");
}
