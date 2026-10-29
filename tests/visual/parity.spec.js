const { AxeBuilder } = require("@axe-core/playwright");
const { test, expect, THEME_VALUES, openPinned, prepareContext, openScreen, PROBES } = require("./support/state");
const { expectedTokens, themeColors, brandFamilies, censusScale } = require("./support/tokens");
const { writeReport, mergeReport } = require("./support/report");
const { screens } = require("./capture-spec.json");
const { differences } = require("./known-differences.json");

// Layer 1 — token parity. Gates: token resolution (semantic tokens, the space/radius/type scales), body text in Inter
// and the census (every capture-spec screen: no off-token colour, radius or font size beyond known-differences.json).
// The other fonts and contrast are reports.
const THEMES = ["dark", "light"];
const CONTRAST_SCREENS = ["g-home", "pages-content-list", "pages-content-editor"]; // S1, S4, S6
const FONT_TARGETS = { title: ".page-title", navLabel: ".sidebar-nav-item__label", button: ".data-table__action-btn" };
const FAMILIES = brandFamilies();
const BRAND_FAMILIES = [FAMILIES.brand, FAMILIES.ui];
const BODY_TEXT = ".data-table__cell[data-column]"; // a text cell (not a checkbox/toggle cell) inherits the body font
const REPORT = { tag: ["@parity", "@desktop"] };

const colorScheme = (theme) => (theme === "dark" ? "dark" : "light");

for (const theme of THEMES) {
  test.describe(`token resolution ${theme}`, () => {
    test.use({ colorScheme: colorScheme(theme) });
    test(`every source token resolves on / (${theme})`, { tag: "@parity" }, async ({ context, page }) => {
      await openPinned({ context, page }, "g-home", theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", THEME_VALUES[theme]);
      const expected = expectedTokens(theme);
      const mismatches = await page.evaluate((tokens) => window.visualProbes.resolveTokens(tokens), expected);
      expect(mismatches).toEqual([]);
    });
  });
}

// A known difference excuses a census finding by `census: [{ property, value }]` (a colour, radius or font size).
const EXCUSED = new Set(differences.flatMap((kd) => (kd.census || []).map(({ property, value }) => `${property}|${value}`)));
const unexcused = (groups) => groups.filter(({ property, value }) => !EXCUSED.has(`${property}|${value}`));

test.describe("census (dark)", () => {
  test.use({ colorScheme: "dark" });
  for (const screen of screens) {
    test.describe(() => {
      test.use({ needsAuth: !screen.noAuth });
      test(`census ${screen.id}`, { tag: ["@parity", "@desktop"] }, async ({ context, page }) => {
        await prepareContext(context, { theme: "dark", collapsed: screen.collapsed });
        const skipReason = await openScreen(page, screen);
        test.skip(Boolean(skipReason), skipReason);
        await page.addScriptTag({ path: PROBES });
        const names = Object.keys(themeColors("dark"));
        const census = await page.evaluate(([tokens, scale]) => window.visualProbes.census(tokens, scale), [
          names,
          censusScale(),
        ]);
        mergeReport("census.json", screen.id, census);
        expect(unexcused([...census.offToken, ...census.offScale])).toEqual([]);
      });
    });
  }
});

async function platformFonts(page, selector) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  if (!nodeId) return { selector, found: false, fonts: [] };
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  return { selector, found: true, fonts: fonts.map((f) => ({ family: f.familyName, isCustomFont: f.isCustomFont })) };
}

test.describe("font gate", () => {
  test.use({ colorScheme: "dark" });
  test("body text renders in the UI font on S4", { tag: ["@parity", "@desktop"] }, async ({ context, page }) => {
    await openPinned({ context, page }, "pages-content-list", "dark");
    const { found, fonts } = await platformFonts(page, BODY_TEXT);
    expect(found, `${BODY_TEXT} not on the page`).toBe(true);
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts).toEqual(fonts.map(() => ({ family: FAMILIES.ui, isCustomFont: true })));
  });
});

test.describe("font gate (report)", () => {
  test.use({ colorScheme: "dark" });
  test("brand fonts render on S4", REPORT, async ({ context, page }) => {
    await openPinned({ context, page }, "pages-content-list", "dark");
    const targets = {};
    for (const [name, selector] of Object.entries(FONT_TARGETS)) targets[name] = await platformFonts(page, selector);
    const brand = Object.values(targets).every(
      ({ fonts }) => fonts.length && fonts.every((f) => f.isCustomFont && BRAND_FAMILIES.includes(f.family))
    );
    writeReport("fonts.json", { screen: "pages-content-list", brandFontsRendered: brand, targets });
  });
});

test.describe("contrast (report)", () => {
  for (const theme of THEMES) {
    test.describe(theme, () => {
      test.use({ colorScheme: colorScheme(theme) });
      for (const id of CONTRAST_SCREENS) {
        test(`color-contrast ${id} (${theme})`, REPORT, async ({ context, page }) => {
          await openPinned({ context, page }, id, theme);
          const { violations } = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
          const nodes = violations.flatMap((v) =>
            v.nodes.map((node) => ({ target: node.target.join(" "), summary: node.failureSummary }))
          );
          mergeReport("contrast.json", `${id}-${theme}`, nodes);
        });
      }
    });
  }
});
