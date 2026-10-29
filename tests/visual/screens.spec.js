const { test, expect, prepareContext, openScreen } = require("./support/state");
const { screens } = require("./capture-spec.json");

// Layer 3 — regression over the capture spec. P1 policy (r04 §8): dark on every screen and viewport,
// light only on the Figma frames S1/S4/S6/S9 (both viewports of their rows). Light is otherwise covered
// by parity + contrast.
const LIGHT_FRAMES = new Set(["S1", "S4", "S6", "S9"]);
const VP_SHORT = { desktop: "d", mobile: "m" };

const inLightPolicy = (screen) =>
  Object.values(screen.figma || {}).some((frame) => LIGHT_FRAMES.has(frame));
const themesFor = (screen) =>
  screen.themes.filter((theme) => theme === "dark" || inLightPolicy(screen));

function badgeMasks(page, stubs) {
  const unstubbed = [
    !stubs.notifications && '[data-testid="notif-count"]',
    !stubs.health && '[data-testid="config-health-count"]',
  ];
  return unstubbed.filter(Boolean).map((css) => page.locator(css));
}

// A row's `masks` cover seed-date cells (dates, ages, times): the seed's day must not change the capture.
const rowMasks = (page, screen) => (screen.masks || []).map((css) => page.locator(css));

function defineScreenTest(screen, viewport, theme) {
  const file = screen.file.replace("{vp}", VP_SHORT[viewport]).replace("{theme}", theme);
  test.describe(() => {
    test.use({ colorScheme: theme === "dark" ? "dark" : "light", needsAuth: !screen.noAuth });
    test(`${screen.id}-${viewport}-${theme}`, { tag: ["@screens", `@${viewport}`] }, async ({ context, page }, testInfo) => {
      const stubs = await prepareContext(context, { theme, collapsed: screen.collapsed });
      const skipReason = await openScreen(page, screen);
      test.skip(Boolean(skipReason), skipReason);
      await expect(page).toHaveScreenshot([testInfo.project.name, file], {
        animations: "disabled",
        caret: "hide",
        mask: [...badgeMasks(page, stubs), ...rowMasks(page, screen)],
      });
    });
  });
}

for (const screen of screens) {
  for (const viewport of screen.viewports) {
    for (const theme of themesFor(screen)) defineScreenTest(screen, viewport, theme);
  }
}
