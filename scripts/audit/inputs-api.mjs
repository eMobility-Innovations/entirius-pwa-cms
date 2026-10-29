// Input audit, API side (plan 61a): the `src/api` functions as method + path, their OpenAPI operation, and the
// schema properties (request body, query parameters) flattened to one constraint record per field.
const METHOD_RE = /\b\w*[aA]pi\.(get|post|put|patch|delete)\(\s*(`[^`]*`|'[^']*'|"[^"]*"|\w+)/;
const GENERIC_DECIMAL = "^(?!^[-+.]*$)[+-]?0*\\d*\\.?\\d*$";
const MAX_DEPTH = 4;

const unquote = (literal) => literal.slice(1, -1);

/** Module-level `const NAME = "..."` strings of an api file; `const base = () => `…`` counts as `base()`. */
export function constantsOf(source) {
  const out = {};
  const re = /^const (\w+)\s*=\s*(\(\)\s*=>\s*)?(`[^`]*`|'[^']*'|"[^"]*");?$/gm;
  for (const [, name, arrow, literal] of source.matchAll(re)) out[arrow ? `${name}()` : name] = unquote(literal);
  return out;
}

/** `${BASE}/${channel}/x/` → "/api/.../{}/x/": known constants inline, every other interpolation is one segment. */
export function resolveTemplate(template, constants, depth = 0) {
  return template.replace(/\$\{\s*([^}]+?)\s*\}/g, (_, expr) =>
    Object.hasOwn(constants, expr) && depth < MAX_DEPTH ? resolveTemplate(constants[expr], constants, depth + 1) : "{}",
  ).split("?")[0];
}

function urlOfBlock(block, constants) {
  const match = block.match(METHOD_RE);
  if (!match) return null;
  let literal = match[2];
  if (/^\w+$/.test(literal)) literal = block.match(new RegExp(`(?:const|let) ${literal}\\s*=\\s*(\`[^\`]*\`|'[^']*'|"[^"]*")`))?.[1];
  if (!literal) return null;
  return { method: match[1], path: resolveTemplate(unquote(literal), constants) };
}

/** Every `export const NAME = … client.method(url …)` of an api file: { NAME: { method, path } }. */
export function catalogOf(source) {
  const constants = constantsOf(source);
  const out = {};
  const blocks = source.split(/^export const /m).slice(1);
  for (const block of blocks) {
    const name = block.match(/^(\w+)/)[1];
    const url = urlOfBlock(block, constants);
    if (url) out[name] = url;
  }
  return out;
}

const segments = (path) => path.split("/").filter(Boolean);
const isWild = (segment) => segment.includes("{");

// Literal = literal scores 2, parameter against parameter 1, a parameter against a literal 0: `/x/{}/` prefers
// `/x/{id}/` over its sibling `/x/export/`.
function matchScore(cms, api) {
  if (cms.length !== api.length) return -1;
  let score = 0;
  for (const [i, segment] of cms.entries()) {
    if (segment === api[i]) score += 2;
    else if (isWild(segment) && isWild(api[i])) score += 1;
    else if (!isWild(segment) && !isWild(api[i])) return -1;
  }
  return score;
}

/** The OpenAPI path a CMS call hits: the best-scoring path that has the method, or null. */
export function matchPath(cmsPath, method, schema) {
  const cms = segments(cmsPath);
  let best = null;
  let bestScore = -1;
  for (const [path, operations] of Object.entries(schema.paths)) {
    const score = operations[method] ? matchScore(cms, segments(path)) : -1;
    if (score > bestScore) [best, bestScore] = [path, score];
  }
  return best;
}

function deref(node, schema) {
  const ref = node?.$ref;
  return ref ? ref.split("/").slice(1).reduce((o, k) => o?.[k], schema) : node;
}

const PLACES_RE = /\\\.\\d\{0,(\d+)\}/;

function placesOf(prop) {
  const fromPattern = prop.pattern?.match(PLACES_RE)?.[1];
  if (fromPattern) return Number(fromPattern);
  if (prop.multipleOf) return (String(prop.multipleOf).split(".")[1] || "").length;
  const example = (prop.examples || []).find((e) => typeof e === "string" && /^-?\d+\.\d+$/.test(e));
  if (example) return example.split(".")[1].length;
  const described = prop.description?.match(/(\d) decimal places/)?.[1];
  return described ? Number(described) : null;
}

const KEYS = ["type", "format", "pattern", "maxLength", "minLength", "minimum", "maximum", "exclusiveMinimum",
  "exclusiveMaximum", "multipleOf", "enum", "examples", "description"];

/** One property as a flat constraint: anyOf/oneOf/allOf variants merged, `null` dropped, decimal places derived. */
export function constraintOf(raw, schema) {
  const variants = [raw, ...(raw.anyOf || []), ...(raw.oneOf || []), ...(raw.allOf || [])].map((v) => deref(v, schema));
  const out = {};
  for (const variant of variants.filter((v) => v && v.type !== "null")) {
    for (const key of KEYS) if (variant[key] !== undefined) out[key] ??= variant[key];
  }
  if (out.pattern === GENERIC_DECIMAL) [out.format, out.pattern] = ["decimal", undefined];
  if (out.format === "decimal" || out.type === "number") out.places = placesOf({ ...raw, ...out });
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}

function objectOf(node, schema) {
  const resolved = deref(node, schema);
  const variants = [resolved, ...(resolved?.anyOf || []), ...(resolved?.allOf || [])].map((v) => deref(v, schema));
  const props = Object.assign({}, ...variants.map((v) => v?.properties || {}));
  const items = variants.find((v) => v?.items)?.items;
  return { props, items };
}

/** Every property under a schema node, nested objects and array items included: [{ path, name, constraint }]. */
export function flattenProps(node, schema, prefix = "", depth = 0) {
  if (!node || depth > MAX_DEPTH) return [];
  const { props, items } = objectOf(node, schema);
  if (items) return flattenProps(items, schema, `${prefix}[]`, depth + 1);
  return Object.entries(props).flatMap(([name, raw]) => {
    const path = prefix ? `${prefix}.${name}` : name;
    return [{ path, name, constraint: constraintOf(raw, schema) }, ...flattenProps(raw, schema, path, depth + 1)];
  });
}

/** The fields an operation takes: its JSON request body, or its query parameters for a GET. */
export function operationFields(schema, path, method) {
  const operation = schema.paths[path]?.[method];
  if (!operation) return [];
  const body = operation.requestBody?.content?.["application/json"]?.schema;
  if (body) return flattenProps(body, schema);
  const query = (operation.parameters || []).map((p) => deref(p, schema)).filter((p) => p?.in === "query");
  return query.map((p) => ({ path: p.name, name: p.name, constraint: constraintOf(p.schema || {}, schema) }));
}
