const { test, expect, THEME_VALUES, prepareContext, openScreen } = require("./support/state");
const { screens } = require("./capture-spec.json");

// Catalogue layers over /ui (docs/testing.md → "Catalogue"). `@catalogue` (tier-1 gates): every section anchor is
// there, every `cat-*` cell is visible with a box, no console error; no screenshot. `@components`: one screenshot per
// cell, plus one per interaction state the cell lists in `data-cat-interact`; baselines in __screenshots__/components/,
// written only by `npm run visual:approve:components` (operator, P3 close).
const SECTIONS = ["icons", "actions", "overlays", "display", "page-frame", "selects", "inputs", "shell"];
// Every component row of the catalogue spec (r02 tech-notes §6), the P4 shell rows included: one anchor each. The
// icons.js registry row is the `icons` section.
const COMPONENTS = [
  "basic-button", "icon-button", "action-bar", "floating-actions", "bulk-action-bar", "readonly-mode",
  "form-field", "basic-input", "basic-textarea", "number-input", "basic-select", "entity-search-picker",
  "channel-multi-select", "basic-checkbox", "basic-radio-group", "basic-switch", "segmented-control", "filter-chip",
  "basic-date-picker", "color-input", "basic-wysiwyg", "permission-matrix",
  "basic-modal", "confirm-dialog", "secret-reveal", "side-drawer", "translations-drawer", "basic-menu", "basic-tooltip",
  "mobile-filter-panel", "status-badge", "count-badge", "tag", "basic-tabs", "basic-card", "panel-card", "media-tile",
  "empty-state", "loader", "pagination", "data-table", "page-header", "breadcrumbs", "page-layout", "basic-logo",
  "app-header", "sidebar-nav", "sidebar-nav-group", "sidebar-nav-item", "mobile-menu", "bottom-tab-bar", "user-menu",
];
// The catalogue renders from static fixtures: it calls no API (the shell around it does).
const API_ORIGIN = new URL(process.env.CMS_API_URL || "http://localhost:8100").origin;
const THEMES = ["dark", "light"];
const VP_SHORT = { desktop: "d", mobile: "m" };
const CELLS = '[data-testid^="cat-"]';
const COMPONENTS_TIMEOUT_MS = 10 * 60 * 1000;
const catalogue = screens.find((row) => row.id === "ui-catalogue");

// The dev server's hot-reload socket: zeno maps the CMS to host port 8180, the client dials the container's 8080.
const DEV_SERVER_NOISE = /^WebSocket connection to 'ws:\/\/[^']+\/ws' failed/;

// Console errors and uncaught exceptions of the page, collected from before the first navigation.
function collectErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !DEV_SERVER_NOISE.test(message.text())) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

// The shell's own boot calls and polls, made on every screen (App.vue): Munin modules and health, the access `me`,
// the bell's count.
const SHELL_CALLS = [/\/api\/munin\/v2\/(health\/)?$/, /\/api\/access\/v2\/me\/$/, /\/notifications\/unread-count\/$/];

// API calls from before the first navigation, so the catalogue's mount counts too. The shell's are not its: a GET
// matching SHELL_CALLS passes while the page boots, and afterwards only as a repeat (a poll) of one the shell made
// then. The catalogue's AppHeader cells mount the real bell and health icon, so anything they call on top shows.
function collectApiCalls(page) {
  const calls = [];
  const shellCalls = new Set();
  let booted = false;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== API_ORIGIN) return;
    const key = `${request.method()} ${url.pathname}`;
    const shellCall = request.method() === "GET" && SHELL_CALLS.some((re) => re.test(url.pathname));
    if (shellCall && (!booted || shellCalls.has(key))) {
      shellCalls.add(key);
      return;
    }
    calls.push(request.url());
  });
  return { calls, booted: () => (booted = true) };
}

async function openCatalogue({ context, page }, theme) {
  await prepareContext(context, { theme });
  await openScreen(page, { ...catalogue, route: `${catalogue.route}?theme=${theme}` });
}

// Cells that render nothing: hidden, or a zero box on either axis.
const emptyCells = (cells) =>
  cells.evaluateAll((els) =>
    els
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || !box.width || !box.height;
      })
      .map((el) => el.dataset.testid)
  );

const INTERACTIONS = {
  hover: (cell) => cell.hover(),
  focus: (cell) => cell.locator("button, a[href], input, select, textarea, [tabindex]").first().focus(),
};

async function resetInteraction(page) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
}

// A cell taller than the viewport (the flat mobile menu on a phone) is captured in a viewport that holds it with
// room for the shell header above it (81 px on a phone), centred: scrolled to the top of a shorter one, the header
// covered its first rows. Returns the restore step.
const HEADER_ROOM = 120;
async function fitViewport(page, cell) {
  const viewport = page.viewportSize();
  const { height } = await cell.boundingBox();
  if (height <= viewport.height - HEADER_ROOM) return async () => {};
  await page.setViewportSize({ width: viewport.width, height: Math.ceil(height) + 2 * HEADER_ROOM });
  await cell.evaluate((el) => el.scrollIntoView({ block: "center" }));
  return () => page.setViewportSize(viewport);
}

async function screenshotCell(page, { id, interact }, suffix) {
  const cell = page.locator(`[data-testid="${id}"]`);
  const file = (state) => `${id}${state ? `--${state}` : ""}__${suffix}.png`;
  await cell.scrollIntoViewIfNeeded();
  const restoreViewport = await fitViewport(page, cell);
  try {
    await expect.soft(cell).toHaveScreenshot(["components", file()]);
    for (const state of interact.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!INTERACTIONS[state]) throw new Error(`${id}: unknown interact state "${state}"`);
      await INTERACTIONS[state](cell);
      await expect.soft(cell).toHaveScreenshot(["components", file(state)]);
      await resetInteraction(page);
    }
  } finally {
    await restoreViewport();
  }
}

for (const theme of THEMES) {
  test.describe(() => {
    test.use({ colorScheme: theme === "dark" ? "dark" : "light" });

    test(`catalogue-${theme}`, { tag: "@catalogue" }, async ({ context, page }) => {
      const errors = collectErrors(page);
      const apiCalls = collectApiCalls(page);
      await openCatalogue({ context, page }, theme);
      apiCalls.booted();
      await expect(page.locator("html")).toHaveAttribute("data-theme", THEME_VALUES[theme]);
      for (const id of SECTIONS) await expect(page.locator(`section#${id}`), `section #${id}`).toHaveCount(1);
      const anchors = await page.locator("[id]").evaluateAll((els) => els.map((el) => el.id));
      expect(COMPONENTS.filter((id) => !anchors.includes(id)), "components missing from the catalogue").toEqual([]);
      const ids = await page.locator(CELLS).evaluateAll((els) => els.map((el) => el.dataset.testid));
      expect(ids.length, "catalogue cells").toBeGreaterThan(0);
      expect(ids.filter((id, i) => ids.indexOf(id) !== i), "duplicate cell ids").toEqual([]);
      expect(await emptyCells(page.locator(CELLS)), "cells without a box").toEqual([]);
      expect(errors, "console errors").toEqual([]);
      expect(apiCalls.calls, "API calls after navigation").toEqual([]);
    });

    test(`components-${theme}`, { tag: "@components" }, async ({ context, page }, testInfo) => {
      test.setTimeout(COMPONENTS_TIMEOUT_MS);
      await openCatalogue({ context, page }, theme);
      const cells = await page
        .locator(CELLS)
        .evaluateAll((els) => els.map((el) => ({ id: el.dataset.testid, interact: el.dataset.catInteract || "" })));
      const suffix = `${VP_SHORT[testInfo.project.name]}__${theme}`;
      for (const cell of cells) await screenshotCell(page, cell, suffix);
    });
  });
}
