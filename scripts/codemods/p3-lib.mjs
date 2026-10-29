// Shared runner of the P3 codemods (scripts/codemods/p3-<section>.mjs). A codemod is a transform:
//   transform(text, file) → { edits: [{ start, end, text }], flags: [{ offset, message }] }
// Edits replace source ranges found through the parsed SFC template, so markup the codemod does not touch stays
// byte-identical. A flag is a call site the codemod cannot decide: the sweep plan resolves it by hand.
// CLI of every codemod: node scripts/codemods/p3-<section>.mjs [--write | --check] [--part 1|2] [files…]
//   (none)     dry run: report every rewrite and every flag
//   --write    apply the rewrites (flags stay)
//   --check    exit 1 while anything is left to rewrite or flagged
//   --part N   only the files of sweep partition N (p3-partitions.mjs); files given by name win over it
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vueParser from "vue-eslint-parser";
import { partitionFiles } from "./p3-partitions.mjs";

// fileURLToPath, not `.pathname`: a checkout path with spaces or non-ASCII letters stays readable.
export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PARSER_OPTIONS = { sourceType: "module", ecmaVersion: "latest" };

export const parseSfc = (text) => vueParser.parse(text, { ...PARSER_OPTIONS, filePath: "file.vue" });
export const parseScript = (text) => vueParser.parse(text, { ...PARSER_OPTIONS, filePath: "file.js" });

// Calls visit(node) for every node of the template (elements, attributes, expressions).
export function walkTemplate(ast, visit) {
  if (!ast.templateBody) return;
  vueParser.AST.traverseNodes(ast.templateBody, { enterNode: visit, leaveNode() {} });
}

// Name of a static attribute or of a bound one (`:icon` → "icon").
export const attributeName = (attr) => (attr.directive ? attr.key.argument?.name : attr.key.name);

// Template helpers shared by the codemods. `findAttr(node, "isdisabled")` matches `isDisabled`, `is-disabled`,
// `:isDisabled`; `bound` narrows it to a directive (true) or a static attribute (false).
export const normalName = (attr) => (attributeName(attr) ?? "").toLowerCase().replace(/-/g, "");
export const findAttr = (node, name, bound) =>
  node.startTag.attributes.find((a) => normalName(a) === name && (bound === undefined || a.directive === bound));
export const sourceOf = (text, node) => text.slice(node.range[0], node.range[1]);
export const lineIndent = (text, offset) =>
  text.slice(text.lastIndexOf("\n", offset - 1) + 1, offset).match(/^\s*/)[0];
export const contentChildren = (node) => node.children.filter((c) => !(c.type === "VText" && !c.value.trim()));
export const expressionOf = (text, attr) => sourceOf(text, attr.value.expression);
export const staticClasses = (node) =>
  (findAttr(node, "class", false)?.value?.value ?? "").split(/\s+/).filter(Boolean);

// Accumulates a transform's result: `edit(start, end, text)`, `flag(node, message)`.
export function collector() {
  const result = { edits: [], flags: [] };
  result.edit = (start, end, replacement) => result.edits.push({ start, end, text: replacement });
  result.flag = (node, message) => result.flags.push({ offset: node.range[0], message });
  return result;
}

// --- shared edits of the P3 codemods -----------------------------------------------------------------------------

export function renameTag(node, target, result) {
  const nameStart = node.startTag.range[0] + 1;
  result.edit(nameStart, nameStart + node.rawName.length, target);
  if (node.endTag) result.edit(node.endTag.range[0] + 2, node.endTag.range[1] - 1, target);
}

export function renameKey(attr, name, result) {
  const key = attr.directive ? attr.key.argument : attr.key;
  result.edit(key.range[0], key.range[1], name);
}

// One attribute after the last one, on the same line.
export function addAttribute(node, attribute, result) {
  const tag = node.startTag;
  const at = tag.attributes.at(-1)?.range[1] ?? tag.range[0] + 1 + node.rawName.length;
  result.edit(at, at, ` ${attribute}`);
}

// New attributes go after the last one, on their own lines when the start tag is multi-line.
export function addAttributes(text, node, attributes, result) {
  if (!attributes.length) return;
  const tag = node.startTag;
  const at = tag.attributes.at(-1)?.range[1] ?? tag.range[0] + 1 + node.rawName.length;
  const multiline = sourceOf(text, tag).includes("\n");
  const separator = multiline ? `\n${lineIndent(text, node.range[0])}  ` : " ";
  result.edit(at, at, attributes.map((attribute) => `${separator}${attribute}`).join(""));
}

// Removes properties of an object literal with their commas, one edit per run of neighbours; all of them leave `{}`.
export function removeProperties(object, removed, result) {
  const properties = object.properties;
  if (removed.size === properties.length) return result.edit(object.range[0], object.range[1], "{}");
  properties.forEach((property, i) => {
    if (!removed.has(property) || removed.has(properties[i - 1])) return;
    let last = i;
    while (removed.has(properties[last + 1])) last += 1;
    const next = properties[last + 1];
    if (next) result.edit(property.range[0], next.range[0], "");
    else result.edit(properties[i - 1].range[1], properties[last].range[1], "");
  });
}

// The `components` option of an Options API default export, when it is an object literal.
export function componentsObject(ast) {
  const exported = ast.body.find((node) => node.type === "ExportDefaultDeclaration")?.declaration;
  const option = exported?.properties?.find((p) => (p.key?.name ?? p.key?.value) === "components");
  return option?.value?.type === "ObjectExpression" ? option.value : null;
}

// Removes a node (an attribute, an element) together with the whitespace in front of it.
export function removeNode(text, node, result) {
  let start = node.range[0];
  while (/\s/.test(text[start - 1])) start -= 1;
  result.edit(start, node.range[1], "");
}

export function applyEdits(text, edits) {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  sorted.forEach((edit, i) => {
    if (i && edit.end > sorted[i - 1].start) throw new Error(`overlapping edits at ${edit.start}`);
  });
  return sorted.reduce((out, { start, end, text: replacement }) => out.slice(0, start) + replacement + out.slice(end), text);
}

// Template errors of an SFC. A self-closing component (`<StatusBadge />`) is valid Vue, but the HTML parser reports
// it; counting it would reject every rewrite that closes a tag.
const SELF_CLOSING = "non-void-html-element-start-tag-with-trailing-solidus";
export const templateErrors = (source) =>
  (parseSfc(source).templateBody?.errors ?? []).filter((error) => error.message !== SELF_CLOSING).length;

const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;

function parseArgs(argv) {
  const partAt = argv.indexOf("--part");
  const part = partAt === -1 ? null : Number(argv[partAt + 1]);
  if (partAt !== -1 && ![1, 2].includes(part)) throw new Error("--part takes 1 or 2");
  const files = argv.filter((arg, i) => !arg.startsWith("--") && (partAt === -1 || i !== partAt + 1));
  return { write: argv.includes("--write"), check: argv.includes("--check"), part, files };
}

// Rewrites one file (when `write`), returns its report lines; a file that is missing or does not parse is one
// ERROR line, not a stack trace, and the run exits 1.
function runFile(file, transform, write) {
  try {
    return transformFile(file, transform, write);
  } catch (error) {
    return { lines: [`${file}  ERROR ${error.message}`], edits: 0, flags: 0, failed: true };
  }
}

function transformFile(file, transform, write) {
  const text = readFileSync(join(ROOT, file), "utf8");
  const { edits, flags } = transform(text, file);
  const lines = [
    ...edits.map((e) => `${file}:${lineOf(text, e.start)}  ${text.slice(e.start, e.end)} → ${e.text}`),
    ...flags.map((f) => `${file}:${lineOf(text, f.offset)}  FLAG ${f.message}`),
  ];
  if (write && edits.length) {
    const out = applyEdits(text, edits);
    // A rewrite that breaks the SFC throws before it is written; the parser only records template errors.
    if (templateErrors(out) > templateErrors(text)) throw new Error("the rewrite breaks the template");
    writeFileSync(join(ROOT, file), out);
  }
  return { lines, edits: edits.length, flags: flags.length };
}

export function runCodemod(name, transform, argv = process.argv.slice(2)) {
  const { write, check, part, files } = parseArgs(argv);
  const targets = files.length ? files : partitionFiles(part ?? undefined);
  const results = targets.map((file) => runFile(file, transform, write));
  results.forEach(({ lines }) => lines.forEach((line) => console.log(line)));
  const edits = results.reduce((sum, r) => sum + r.edits, 0);
  const flags = results.reduce((sum, r) => sum + r.flags, 0);
  console.log(`${name}: ${edits} rewrite(s)${write ? " applied" : ""}, ${flags} flag(s) in ${targets.length} file(s)`);
  if (results.some((r) => r.failed) || (check && edits + flags)) process.exitCode = 1;
}
