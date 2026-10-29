const fs = require("fs");
const path = require("path");

// Expected token values, read from the token sources (not from the built CSS the parity check verifies):
// the CMS semantic map and the @entirius/brand-tokens CSS it points into.
const ROOT = path.resolve(__dirname, "../../..");
const SEMANTIC = path.join(ROOT, "src/assets/tokens/semantic.json");
const BRAND_CSS = require.resolve("@entirius/brand-tokens/tokens.css");
function declarations(block, prefix) {
  const pattern = new RegExp(`(--${prefix}-[\\w-]+):\\s*([^;]+);`, "g");
  return Object.fromEntries([...block.matchAll(pattern)].map((m) => [m[1], m[2].trim()]));
}

// `:root { --brand-*: … }` of the package, var() references resolved → { "--brand-black": "#0D0A09", … }
function brandValues() {
  const raw = declarations(fs.readFileSync(BRAND_CSS, "utf8").split("@font-face")[0], "brand");
  const resolve = (value) => value.replace(/var\((--brand-[\w-]+)\)/g, (_, name) => resolve(raw[name]));
  return Object.fromEntries(Object.entries(raw).map(([name, value]) => [name, resolve(value)]));
}

// "{light.basic.50}" → the brand value; raw values (overlays, light shadows) pass through.
function brandValue(brand, raw) {
  const ref = raw.match(/^\{(.+)\}$/);
  if (!ref) return raw;
  const name = `--brand-${ref[1].replaceAll(".", "-")}`;
  if (!brand[name]) throw new Error(`semantic.json: ${raw} → ${name} is not in @entirius/brand-tokens`);
  return brand[name];
}

const entries = (group) => Object.entries(group).filter(([key]) => !key.startsWith("$"));

// Every colour, overlay and shadow token of semantic.json → the value its brand reference resolves to.
// A gradient (`type: background`) normalises through `background`, a shadow through `box-shadow`.
function semanticTokens(theme) {
  const map = JSON.parse(fs.readFileSync(SEMANTIC, "utf8"));
  const brand = brandValues();
  const tokens = { color: {}, background: {}, boxShadow: {} };
  const put = (kind, [name, token]) => (tokens[kind][`--${name}`] = brandValue(brand, token[theme]));
  Object.values(map.color).flatMap(entries).forEach((row) => put(row[1].type === "background" ? "background" : "color", row));
  entries(map.overlay).forEach((row) => put("color", row));
  entries(map.shadow).forEach((row) => put("boxShadow", row));
  return tokens;
}

// A theme-independent group of semantic.json (`space`, `radius`, `font-size`) → { "--space-1": "4px", … }:
// the scales main.scss must emit, brand references resolved.
function scale(group) {
  const map = JSON.parse(fs.readFileSync(SEMANTIC, "utf8"));
  const brand = brandValues();
  return Object.fromEntries(entries(map[group]).map(([name, value]) => [`--${name}`, brandValue(brand, value)]));
}

// kind → the CSS property a probe element normalises the value through. Fails closed: a source the parser
// no longer understands must break the gate, never shrink it to nothing.
function expectedTokens(theme) {
  const semantic = semanticTokens(theme);
  const expected = {
    color: semantic.color,
    background: semantic.background,
    boxShadow: semantic.boxShadow,
    borderTopLeftRadius: scale("radius"),
    marginLeft: scale("space"),
    fontSize: scale("font-size"),
  };
  const empty = Object.keys(expected).filter((kind) => !Object.keys(expected[kind]).length);
  const unresolved = Object.values(expected).flatMap((tokens) => Object.keys(tokens).filter((name) => !tokens[name]));
  if (empty.length) throw new Error(`no ${empty.join(", ")} tokens parsed for ${theme}: update support/tokens.js`);
  if (unresolved.length) throw new Error(`no brand value for ${unresolved.join(", ")}`);
  return expected;
}

// First family of each brand stack: { brand: "Lexend Deca", ui: "Inter" }
function brandFamilies() {
  const brand = brandValues();
  const first = (stack) => stack.split(",")[0].trim().replace(/["']/g, "");
  return { brand: first(brand["--brand-font-family-brand"]), ui: first(brand["--brand-font-family-ui"]) };
}

// Colour token names of the semantic layer for a theme (census input).
const themeColors = (theme) => semanticTokens(theme).color;

// The census scale: every radius and font-size step as a computed px value.
const censusScale = () => ({ radius: Object.values(scale("radius")), fontSize: Object.values(scale("font-size")) });

module.exports = { expectedTokens, themeColors, brandFamilies, censusScale };
