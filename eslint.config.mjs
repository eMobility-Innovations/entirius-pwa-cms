// CMS UI lint, template side. Rule IDs (C1…, T1…) refer to docs/ui-rules.md.
// Templates only, no JS style rules. Every UI rule is an error (LEVEL, P5 plan 56); C2 (removed components) and C5
// (icon-font glyphs) run under the "vue-p3" plugin name, the old class names under "vue-p2".
import { readdirSync, readFileSync } from "node:fs";
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

const LEVEL = "error";
const RULES = "docs/ui-rules.md";

// C2 removed component → its replacement, merged from scripts/lint/removed-components/*.json ({ "Old": "New" }). The P3
// plan that retires a component adds its own <section>.json (r02 removal list: BackBar, LockedField, ToolTip, …).
const REMOVED_DIR = new URL("./scripts/lint/removed-components/", import.meta.url);
const REMOVED_COMPONENTS = Object.assign(
  {},
  ...readdirSync(REMOVED_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(new URL(file, REMOVED_DIR), "utf8")))
);

const NO_REMOVED_COMPONENT = Object.entries(REMOVED_COMPONENTS).map(([old, replacement]) => ({
  selector: `VElement[rawName='${old}']`,
  message: `${old} is removed: use <${replacement}> (${RULES} § Components).`,
}));
// C2 removed FormField props (plan 60): one field-hint pattern, `hint` + `hintLevel`. Matched on the normalised name
// (`formfield` / `form-field`), so the kebab-case tag is caught too.
const NO_REMOVED_FIELD_PROP = ["description", "tooltip"].flatMap((prop) =>
  [`[directive=false][key.name='${prop}']`, `[directive=true][key.argument.name='${prop}']`].map((attr) => ({
    selector: `VElement[name=/^form-?field$/] > VStartTag > VAttribute${attr}`,
    message: `FormField ${prop} is removed: use hint + hintLevel (${RULES} § Forms).`,
  }))
);
// T1/T3 no raw colour or px in a static style attribute.
const NO_RAW_INLINE_STYLE = {
  selector: "VAttribute[directive=false][key.name='style'][value.value=/#[0-9a-fA-F]{3,8}\\b|rgba?\\(|\\d+px/]",
  message: `Raw value in style="": use a token or a utility class (${RULES} § Tokens).`,
};
// T1/T3–T5 old class names (removed in P2) render nothing: an error, not debt. The palette classes; the old spacing
// steps; radius from spacing (br-50, br-tl-50, br-50-mobile) and the plan-06 radius names (radius classes are rounded-*,
// br- is border-right only); the removed sizes and weights.
const OLD_CLASSES = [
  "/^(t|bg|b|bb|bt|bl|br|o|stroke)-(basic|support|primary|positive|negative|warning|informative|notice)-\\d+(-hover)?$/",
  "/^(p|pt|pr|pb|pl|pv|ph|m|mt|mr|mb|ml|mv|mh|gap)-(50|100|200|300|400|500|600|700)(-[a-z]+)?$/",
  "/^(br|radius)-((tl|tr|bl|br)-)?(\\d+|sm|md|base|lg|xl|2xl|3xl|4xl|full)(-[a-z]+)?$/",
  "/^(fs-(800|900|1000)|fw-(100|700))$/",
];
// R6 a template picks an icon by meaning from the registry (`:icon="$icons.edit"`), never by a glyph name: a literal
// `icon="…"`, or a string an `:icon` binding evaluates to (the whole expression, a ternary branch, an `||` / `??`
// operand; a string in a condition is no glyph). scripts/codemods/p3-icons.mjs rewrites them.
const ICON_ELEMENT = "VElement[rawName=/^(FontAwesomeIcon|font-awesome-icon)$/] > VStartTag";
const ICON_BINDING = `${ICON_ELEMENT} > VAttribute[directive=true][key.argument.name='icon']`;
const NO_LITERAL_ICON = [
  `${ICON_ELEMENT} > VAttribute[directive=false][key.name='icon']`,
  `${ICON_BINDING} > VExpressionContainer > Literal`,
  `${ICON_BINDING} ConditionalExpression > Literal.consequent`,
  `${ICON_BINDING} ConditionalExpression > Literal.alternate`,
  `${ICON_BINDING} LogicalExpression > Literal`,
].map((selector) => ({ selector, message: `Pick a meaning from $icons (${RULES} R6).` }));
// C1 <input type="file"> stays raw: it is the hidden picker behind an upload button.
const NO_RAW_INPUT = {
  selector: "VElement[rawName='input']:not(:has(VAttribute[key.name='type'][value.value='file']))",
  message: `Use a boot input: BasicInput, NumberInput, ColorInput, BasicCheckbox, BasicRadioGroup, BasicSwitch (${RULES} § Components).`,
};

export default [
  { ignores: ["dist/**", "node_modules/**", "__client/**", "tests/**", "public/**"] },
  {
    files: ["src/**/*.vue"],
    plugins: { vue },
    languageOptions: {
      parser: vueParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    rules: {
      "vue/no-restricted-syntax": [LEVEL, NO_RAW_INLINE_STYLE, ...NO_LITERAL_ICON],
    },
  },
  {
    // C2 removed components (P3 closed them) and removed FormField props (plan 60): an error, boots included. The vue
    // plugin under a second name keeps this list apart from the inline-style and icon list above (a later block would
    // replace its options).
    files: ["src/**/*.vue"],
    plugins: { "vue-p3": vue },
    rules: { "vue-p3/no-restricted-syntax": ["error", ...NO_REMOVED_COMPONENT, ...NO_REMOVED_FIELD_PROP] },
  },
  {
    // C5 no icon-font glyph (the font is deleted, a glyph class draws nothing): an error. Boots own icon-* classes of
    // their own (IconButton, the BasicInput icon wrapper).
    files: ["src/**/*.vue"],
    ignores: ["src/boots/**"],
    plugins: { "vue-p3": vue },
    rules: { "vue-p3/no-restricted-class": ["error", "/^icon-(?!only-mobile$)/"] },
  },
  {
    // C3 no hand-rolled copy of a boot class.
    files: ["src/**/*.vue"],
    ignores: ["src/boots/**"], // boots own these classes
    rules: {
      "vue/no-restricted-class": [
        LEVEL,
        "filter-chip",
        "status-badge",
        "pim-badge",
        "chip",
      ],
    },
  },
  {
    // Old class names, boots included. The vue plugin under a second name keeps this list apart from the C3 list
    // above (a later block would replace its options).
    files: ["src/**/*.vue"],
    plugins: { "vue-p2": vue },
    rules: { "vue-p2/no-restricted-class": ["error", ...OLD_CLASSES] },
  },
  {
    // C1 views, panel components and functionals build UI from boots; boots are the implementations. No native
    // <select> outside the boots: BasicSelect (a select without a FormField label takes `floatingLabel`).
    files: ["src/views/**/*.vue", "src/components/**/*.vue", "src/functionals/**/*.vue", "src/App.vue"],
    rules: {
      "vue/no-restricted-html-elements": [
        LEVEL,
        { element: "button", message: `Use <BasicButton> (${RULES} § Components).` },
        { element: "textarea", message: `Use <BasicTextarea> (${RULES} § Components).` },
        { element: "select", message: `Use <BasicSelect> (${RULES} § Components).` },
      ],
      // Repeats the shared selectors: a later block replaces a rule's options, it does not merge them.
      "vue/no-restricted-syntax": [LEVEL, NO_RAW_INLINE_STYLE, ...NO_LITERAL_ICON, NO_RAW_INPUT],
    },
  },
];
