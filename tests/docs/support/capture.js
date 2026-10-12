const fs = require("fs");
const path = require("path");
const base = require("@playwright/test");
const {
  pinPreferences,
  idle,
  settle,
  waitForData,
  assertLanded,
  isHealth,
  isNotifications,
} = require("../../visual/support/state");
const { loopbackUrl } = require("../../helpers/loopback");

// Documentation screenshots from the live, seeded stack: English, dark theme, the viewport of the config. Unlike the
// visual harness, a capture run writes for real (an "after save" state has to exist) and keeps the real clock (live
// records carry server times, and the CMS refreshes its own token). Only the two header polls are answered here.
//
// Rules every guide spec follows:
// - One spec per guide in `guides/`: the file name is the guide name, the image folder and the docs page slug.
// - Steps are `test.step(title)`.
// - Selectors come from the existing e2e specs or `data-testid` / `data-fid`, never from Polish text.
// - A list shot shows only seeded demo rows (the product list: type `ENT-` into its search field, the prefix of
//   every demo SKU).
// - A spec that creates a record names it `Docs …` and deletes it in the same spec, through the UI.
// - A spec that edits a seeded record restores the original value before it ends, so a guide can be re-run on the
//   same database.
// - A spec that cannot restore (a record the UI cannot delete, an irreversible action) says so in its header
//   comment, names what each run leaves behind, and fails with `INFRA: <guide> needs a fresh make seed` when its
//   start state is gone.
// - Never click the theme toggle or the language switch.

// A capture run signs in and writes: checked here too, for a spec run with another config.
loopbackUrl("CMS_BASE_URL", "http://localhost:8180");

const LOGIN_BUTTON = 'button:has-text("Log in")';
const SHOT_NAME = /^\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/;
const CALLOUT_LABEL = /^[1-9]$/;
const CALLOUT_CSS = "[data-docs-callout]";

const json = (body) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

// Configuration warnings of a dev stack and its notifications are not part of any guide.
async function stubPolls(context) {
  await context.route(isNotifications("/notifications/"), (route) => route.fulfill(json({ count: 0, results: [] })));
  await context.route(isNotifications("/notifications/unread-count/"), (route) => route.fulfill(json({ unread: 0 })));
  await context.route(isHealth, (route) =>
    route.request().method() === "GET"
      ? route.fulfill(json({ checked_at: new Date().toISOString(), checks: [] }))
      : route.fallback()
  );
}

// The `user` cookie lands only after profile and permissions resolve; without it the sidebar renders empty.
async function signIn(page) {
  await page.goto("/");
  await page.fill('input[type="text"]', process.env.CMS_USER || "admin");
  await page.fill('input[type="password"]', process.env.CMS_PASSWORD || "admin123");
  await page.click(LOGIN_BUTTON);
  await page.waitForFunction(() => document.cookie.includes("user="), null, { timeout: 30000 });
  await idle(page);
}

/**
 * `@playwright/test` `test` for guide specs. Every test gets a fresh context pinned to English, the dark theme and
 * an open sidebar, with the notification and configuration-health polls answered empty. Option `signedIn` (default
 * `true`) logs in through the login form as `CMS_USER` / `CMS_PASSWORD`; `test.use({ signedIn: false })` leaves the
 * login screen up.
 */
const test = base.test.extend({
  signedIn: [true, { option: true }],
  context: async ({ context }, use) => {
    await pinPreferences(context, { theme: "dark", lang: "EN", collapsed: false });
    await stubPolls(context);
    await use(context);
  },
  page: async ({ page, signedIn }, use) => {
    if (signedIn) await signIn(page);
    await use(page);
  },
});

/** `expect` of `@playwright/test`, re-exported so a guide spec has one import. */
const expect = base.expect;

/**
 * Opens a route and waits until its data has rendered.
 * @param {import("@playwright/test").Page} page
 * @param {string} route path under the CMS base URL
 * @param {{ ready?: string, noAuth?: boolean }} [options] `ready`: a selector only the loaded state has;
 *   `noAuth`: the login screen is the expected result
 */
async function goto(page, route, { ready, noAuth = false } = {}) {
  const screen = { id: route, route, readySelector: ready, noAuth };
  await page.goto(route);
  await idle(page);
  await assertLanded(page, screen);
  await settle(page);
  await waitForData(page, screen);
}

const viewportClip = (page) => ({ x: 0, y: 0, ...page.viewportSize() });
const inside = (box, clip) =>
  box.x >= clip.x &&
  box.y >= clip.y &&
  box.x + box.width <= clip.x + clip.width &&
  box.y + box.height <= clip.y + clip.height;

// The element's box plus `padding` on each side, clamped to the viewport.
async function elementClip(page, selector, padding) {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error(`no visible element to crop: ${selector}`);
  const view = page.viewportSize();
  if (box.height > view.height) throw new Error(`crop taller than the viewport: ${selector}`);
  const x = Math.max(0, Math.floor(box.x - padding));
  const y = Math.max(0, Math.floor(box.y - padding));
  const right = Math.min(view.width, Math.ceil(box.x + box.width + padding));
  const bottom = Math.min(view.height, Math.ceil(box.y + box.height + padding));
  return { x, y, width: right - x, height: bottom - y };
}

// Runs in the browser: one fixed layer per callout, a ring 4 px outside the target's box and a numbered disc centred
// on the ring's top-right corner.
function drawCallout({ box, label }) {
  const layer = document.createElement("div");
  layer.setAttribute("data-docs-callout", label);
  layer.style.cssText =
    "position:fixed;z-index:2147483647;pointer-events:none;box-sizing:border-box;" +
    "border:2px solid #00ACC1;border-radius:6px;" +
    `left:${box.x - 6}px;top:${box.y - 6}px;width:${box.width + 12}px;height:${box.height + 12}px`;
  const disc = document.createElement("span");
  disc.textContent = label;
  disc.style.cssText =
    "position:absolute;top:-13px;right:-13px;width:22px;height:22px;border-radius:50%;" +
    "background:#00ACC1;color:#0B0F14;font:700 13px/22px system-ui;text-align:center";
  layer.append(disc);
  document.body.append(layer);
}

async function drawCallouts(page, callouts, clip) {
  for (const { target, label } of callouts) {
    if (!CALLOUT_LABEL.test(label)) throw new Error(`callout label must be "1" to "9": ${label}`);
    const box = await page.locator(target).first().boundingBox();
    if (!box || !inside(box, clip)) throw new Error(`callout target outside the shot: ${target}`);
    await page.evaluate(drawCallout, { box, label });
  }
}

const clearCallouts = (page) =>
  page.evaluate((css) => document.querySelectorAll(css).forEach((layer) => layer.remove()), CALLOUT_CSS);

async function capture(page, file, { element, padding = 16, callouts = [] }) {
  await page.mouse.move(0, 0);
  await idle(page, 5000);
  await settle(page);
  const clip = element ? await elementClip(page, element, padding) : viewportClip(page);
  try {
    await drawCallouts(page, callouts, clip);
    await page.screenshot({ path: file, clip });
  } finally {
    await clearCallouts(page);
  }
}

/**
 * @typedef {{ target: string, label: string }} Callout `target`: selector of the element to ring; `label`: "1"–"9"
 * @typedef {{ element?: string, padding?: number, callouts?: Callout[] }} ShotOptions without `element` the shot is
 *   the viewport; with it, the first match plus `padding` (default 16) on each side, clamped to the viewport
 * @callback Shot
 * @param {import("@playwright/test").Page} page
 * @param {string} name `NN-slug`, unique within the guide; the file is `<name>.png`
 * @param {ShotOptions} [options]
 * @returns {Promise<string>} the path of the written file
 */

/**
 * The shots of one guide, written to `<DOCS_SCREENS_OUT>/<name>/`. The folder is created on the first shot.
 * @param {string} name guide name: the spec file name and the docs page slug
 * @returns {{ shot: Shot }}
 */
function guide(name) {
  if (!process.env.DOCS_SCREENS_OUT) throw new Error("INFRA: DOCS_SCREENS_OUT is not set");
  const dir = path.join(process.env.DOCS_SCREENS_OUT, name);
  const taken = new Set();
  const shot = async (page, shotName, options = {}) => {
    if (!SHOT_NAME.test(shotName)) throw new Error(`shot name must be NN-slug (lower case, hyphens): ${shotName}`);
    if (taken.has(shotName)) throw new Error(`shot name used twice in guide ${name}: ${shotName}`);
    taken.add(shotName);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${shotName}.png`);
    await capture(page, file, options);
    return file;
  };
  return { shot };
}

module.exports = { test, expect, guide, goto };
