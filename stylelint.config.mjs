// CMS UI lint, style side. Rule IDs (T1…) refer to docs/ui-rules.md § Tokens.
// Every rule is an error (P5 plan 56): a UI-rule violation fails `npm run lint:ui`.
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const OLD_COLOUR_VAR = /var\(\s*--c-[a-z]+-\d/;
const OLD_COLOUR_CLASS = /\.(t|bg|b|bb|bt|bl|br|o|stroke)-(basic|support|primary|positive|negative|warning|informative|notice)-\d+/;
const OLD_SCALE_VAR = /var\(\s*--(space-(50|100|200|300|400|500|600|700)|radius-(sm|md)|fs-(800|900|1000))\b/;
// Old spacing steps, radius from spacing (br-50, br-tl-50, br-50-mobile), plan-06 radius names, removed sizes/weights.
const OLD_SCALE_CLASS =
  /\.((p|pt|pr|pb|pl|pv|ph|m|mt|mr|mb|ml|mv|mh|gap)-(50|100|200|300|400|500|600|700)|(br|radius)-((tl|tr|bl|br)-)?(\d+|sm|md|base|lg|xl|2xl|3xl|4xl|full)|fs-(800|900|1000)|fw-(100|700))(?!\w)/;
const BASE_VALUES = ["0", "auto", "inherit", "initial", "unset", "none"];
const MARGIN_PADDING = "/^(margin|padding)-(top|right|bottom|left|inline|block)(-(start|end))?$/";
// T3 1–3 px hairline alignments (border compensation, focus offsets, icon nudges) have no step and stay raw
const SPACING_VALUES = [...BASE_VALUES, "/^-?[1-3]px$/"];

// Every custom property the CMS defines globally: the literal declarations of the global SCSS (semantic layer,
// main.scss, utils) and the scales main.scss emits from loops. Local ones (declared in the same file) are known to
// the rule without this list.
function cmsCustomProperties() {
  const root = new URL("src/assets/scss/", import.meta.url);
  const scss = (file) => readFileSync(new URL(file, root), "utf8");
  const declared = (text) => [...text.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]);
  const list = (text, name) => text.match(new RegExp(`\\$${name}:\\s*([^;]+);`))[1].split(",").map((v) => v.trim());
  const spacing = scss("variables/_spacing.scss");
  const files = readdirSync(root, { recursive: true }).filter((file) => file.endsWith(".scss"));
  const names = [
    ...files.flatMap((file) => declared(scss(file))),
    ...list(spacing, "brand-space-steps").map((step) => `--space-${step}`),
    ...list(spacing, "brand-radii").map((radius) => `--radius-${radius}`),
    ...[...scss("variables/_fonts.scss").matchAll(/^\s*(\d+):/gm)].map((m) => `--fs-${m[1]}`),
  ];
  return { customProperties: Object.fromEntries(names.map((name) => [name, "defined"])) };
}

export default {
  defaultSeverity: "error",
  plugins: ["stylelint-declaration-strict-value", "stylelint-value-no-unknown-custom-properties"],
  overrides: [
    { files: ["**/*.vue"], customSyntax: "postcss-html" },
    { files: ["**/*.scss"], customSyntax: "postcss-scss" },
  ],
  // Token definitions are the one place raw values are allowed.
  ignoreFiles: [
    "src/assets/scss/themes/**",
    "src/assets/scss/variables/**",
    "src/assets/scss/main.scss",
    "src/assets/scss/typo/wysiwyg-icons/**",
  ],
  rules: {
    // T1 colour comes from a token
    "color-no-hex": true,
    "color-named": "never",
    "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla", "hwb"],
    // T1/T3–T5 no old token (error) · T2 no fallback on a token: var(--text-body, #fff) hides a missing token
    "declaration-property-value-disallowed-list": [
      {
        "/.*/": [OLD_COLOUR_VAR, OLD_SCALE_VAR, "/var\\(\\s*--(space|fs|radius|shadow|overlay|surface|text|border|accent|positive|negative|warning|info)[\\w-]*\\s*,/"],
        // T4 radius comes from the radius scale, never from spacing (var(--space-50) as a radius)
        "/radius$/": ["/var\\(\\s*--(?!radius-)/"],
      },
    ],
    // T1/T3/T4 no old palette, spacing or radius class as a selector
    "selector-disallowed-list": [[OLD_COLOUR_CLASS, OLD_SCALE_CLASS]],
    // T1–T5 a var() names a token that exists: the brand package, the semantic layer, the CMS scales, or a local one
    "csstools/value-no-unknown-custom-properties": [
      true,
      { importFrom: [createRequire(import.meta.url).resolve("@entirius/brand-tokens/tokens.css"), cmsCustomProperties()] },
    ],
    // T3 spacing, T4 radius, T5 type size and shadow come from tokens
    "scale-unlimited/declaration-strict-value": [
      [
        MARGIN_PADDING,
        "gap",
        "row-gap",
        "column-gap",
        "/^border-(top|bottom)-(left|right)-radius$/",
        "font-size",
        "box-shadow",
      ],
      {
        ignoreVariables: true,
        ignoreFunctions: true, // calc()/min()/clamp(); raw colour functions are caught by T1
        expandShorthand: true, // margin/padding/border-radius shorthands are checked per side
        ignoreValues: {
          "": BASE_VALUES,
          [MARGIN_PADDING]: SPACING_VALUES,
          gap: SPACING_VALUES,
          "row-gap": SPACING_VALUES,
          "column-gap": SPACING_VALUES,
          "/^border-(top|bottom)-(left|right)-radius$/": ["0", "50%", "inherit"],
          "font-size": ["inherit", "100%", "1em"],
        },
        message: "Raw ${value} in ${property}: use a token (docs/ui-rules.md § Tokens)",
      },
    ],
  },
};
