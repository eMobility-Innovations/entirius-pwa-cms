const path = require("path");
const base = require("@playwright/test");
const { freeze: FREEZE, screens } = require("../capture-spec.json");
const { loopbackUrl } = require("../../helpers/loopback");

// Deterministic state recipe (roadmap r04 tech-notes §2). The zeno stack is shared: this module never clicks
// the theme toggle or the language switch, and every write the page tries is answered by a stub.
// The access JWT lives 300 s: a cached login plus one test (timeout 90 s) must stay inside it.
const AUTH_MAX_AGE_MS = 3 * 60 * 1000;
// The CMS refreshes before the `expiryDate` it set at login (real time + token lifetime). The frozen clock lies
// before it, so no refresh comes due, and the CMS caps the timer below the setTimeout overflow.
const API_URL = loopbackUrl("CMS_API_URL", "http://localhost:8100");
const THEME_VALUES = { dark: "dark", light: "default" };
const READ_METHODS = ["GET", "HEAD", "OPTIONS"];
// The UI language the harness pins and the browser locale; unset = Polish, the language of the committed baselines.
const LANG = (process.env.CMS_LANG || "PL").toUpperCase();
const LOCALE = process.env.CMS_LOCALE || "pl-PL";
const LOGIN_BUTTON = 'button:has-text("Zaloguj"), button:has-text("Log in")';
const LOGIN_PREFS = { cms_theme: "dark", cms_lang: LANG, cms_sidebar_collapsed: "false" };
const PROBES = path.join(__dirname, "probes.browser.js");
const FREEZE_CSS =
  "*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}";
// A screen counts as loaded when none of these is visible (and the row's `readySelector` is, when it has one).
const LOADING_CSS = '.loader, .loader-element, .skeleton, [aria-busy="true"]';
// A loading message ends in an ellipsis ("Ładowanie…", "Loading supplier data..."); a permanent label that merely
// starts with the word ("Ładowanie palet") does not.
const LOADING_TEXT = /^(Ładowanie|Loading)\b.*(…|\.\.\.)$/;
const DATA_TIMEOUT_MS = 10000;
const HEALTH_BODY = {
  checked_at: FREEZE,
  checks: [
    {
      code: "visual.fixture",
      module: "munin",
      state: "unconfigured",
      severity: "low",
      title: "Visual harness fixture check",
      // A hostname and a path are no tokens: the row breaks them, so @ux measures the long words on a phone.
      detail: "Point EMAIL_HOST at smtp-relay.notifications.eu-central-1.example.test and restart after editing /srv/entirius/volkanos/main/settings_local.py.",
      scope: "default-europe",
    },
  ],
};

class InfraError extends Error {
  constructor(message) {
    super(`INFRA: ${message}`);
    this.name = "InfraError";
  }
}

let auth = { state: null, at: 0 };

// `networkidle` fires once per document: after an in-app navigation (a row click) it resolves at once, while the new
// route still fetches its data and the async boot chunks (FormField, EmptyState, Pagination…) it renders. So the
// requests in flight are counted per page, and idle also waits until none has been open for QUIET_MS.
const QUIET_MS = 500;
const inflight = new WeakMap();

function track(page) {
  if (!inflight.has(page)) {
    const pending = new Set();
    page.on("request", (request) => pending.add(request));
    page.on("requestfinished", (request) => pending.delete(request));
    page.on("requestfailed", (request) => pending.delete(request));
    inflight.set(page, pending);
  }
  return inflight.get(page);
}

async function idle(page, timeout = 15000) {
  const pending = track(page);
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
  const deadline = Date.now() + timeout;
  let quietSince = Date.now();
  while (Date.now() - quietSince < QUIET_MS && Date.now() < deadline) {
    if (pending.size) quietSince = Date.now();
    await page.waitForTimeout(50);
  }
}

const json = (body) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(body),
});
const onApi = (url) => url.origin === new URL(API_URL).origin;
const isNotifications = (suffix) => (url) =>
  onApi(url) && url.pathname.startsWith("/api/notifications/") && url.pathname.endsWith(suffix);
const isHealth = (url) => onApi(url) && url.pathname === "/api/munin/v2/health/";
const isProfile = (url) => onApi(url) && /\/customer\/[^/]+\/profile\/$/.test(url.pathname);
// Login and token refresh write no data; a stubbed `{}` would leave the session without a token.
// Blacklist (logout) is a write and stays stubbed.
const isAuthCall = (url) => /\/customer\/tokens\/(refresh\/)?$/.test(url.pathname);

// Registered first = matched last: the specific stubs below win over this one.
async function stubWrites(context) {
  await context.route(onApi, (route) =>
    READ_METHODS.includes(route.request().method()) || isAuthCall(new URL(route.request().url()))
      ? route.fallback()
      : route.fulfill(json({}))
  );
}

// The `user` cookie lands only after profile + permissions resolve; without it the desktop sidebar renders empty.
async function submitLogin(page) {
  await page.goto("/");
  await page.fill('input[type="text"]', process.env.CMS_USER || "admin");
  await page.fill('input[type="password"]', process.env.CMS_PASSWORD || "admin123");
  await page.click(LOGIN_BUTTON);
  await page.waitForFunction(() => document.cookie.includes("user="), null, { timeout: 30000 });
  await idle(page);
}

async function login(browser, baseURL) {
  if (auth.state && Date.now() - auth.at < AUTH_MAX_AGE_MS) return auth.state;
  const context = await browser.newContext({ baseURL, locale: LOCALE });
  try {
    const startedAt = Date.now();
    await stubWrites(context);
    await context.route(isProfile, (route) => profileRoute(route, LOGIN_PREFS));
    await submitLogin(await context.newPage());
    auth = { state: await context.storageState(), at: startedAt };
    return auth.state;
  } catch (err) {
    throw new InfraError(`login failed (stack down or wrong credentials?): ${err.message.split("\n")[0]}`);
  } finally {
    await context.close();
  }
}

async function profileRoute(route, prefs) {
  if (route.request().method() !== "GET") return route.fulfill(json({}));
  const response = await route.fetch();
  const body = await response.json().catch(() => null);
  if (!body) return route.fulfill({ response });
  const target = body.data || body;
  target.extra = { ...(target.extra || {}), ...prefs, cms_sidebar_collapsed: prefs.cms_sidebar_collapsed === "true" };
  return route.fulfill({ response, json: body });
}

// Theme, language and sidebar on every page load: `localStorage` plus the rewritten profile GET. Every profile write
// is answered `{}`, so the admin profile the stack shares never flips.
async function pinPreferences(context, { theme, lang, collapsed = false }) {
  const prefs = { cms_theme: THEME_VALUES[theme], cms_lang: lang, cms_sidebar_collapsed: String(collapsed) };
  await context.addInitScript((values) => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  }, prefs);
  await context.route(isProfile, (route) => profileRoute(route, prefs));
}

// Returns which fixed-body stubs answered; a badge whose stub was never hit gets masked.
async function prepareContext(context, { theme, collapsed = false }) {
  const stubs = { notifications: false, health: false };
  await stubWrites(context);
  await pinPreferences(context, { theme, lang: LANG, collapsed });
  await context.route(isNotifications("/notifications/"), (route) => route.fulfill(json({ count: 0, results: [] })));
  await context.route(isNotifications("/notifications/unread-count/"), (route) => {
    stubs.notifications = true;
    return route.fulfill(json({ unread: 0 }));
  });
  await context.route(isHealth, (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    stubs.health = true;
    return route.fulfill(json(HEALTH_BODY));
  });
  return stubs;
}

// An expired session lands on `/` or renders the login wall in place (on `/` itself).
async function assertLanded(page, screen) {
  const expected = new URL(screen.route, page.url()).pathname;
  const actual = new URL(page.url()).pathname;
  if (actual !== expected) throw new InfraError(`expected ${expected}, landed on ${actual} (expired session?)`);
  if (!screen.noAuth && (await page.locator(LOGIN_BUTTON).count())) {
    throw new InfraError(`${screen.id}: login wall instead of the screen (expired session?)`);
  }
}

async function settle(page) {
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(() => document.fonts.ready.then(() => true)); // self-hosted brand fonts (r01 § Fonts)
  await page
    .waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout: 10000 })
    .catch(() => {});
}

// Runs in the browser (serialised by waitForFunction): true once no loader or loading text is visible. The text is
// read per element from its own text nodes, so "Ładowanie…" next to a spinner child counts too. A loading state
// inside a catalogue cell (`cat-*`) is a fixture, never pending data.
function noLoaderVisible({ css, text }) {
  const shown = (el) =>
    !el.closest('[data-testid^="cat-"]') && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  if ([...document.querySelectorAll(css)].some(shown)) return false;
  const pattern = new RegExp(text);
  const ownText = (el) =>
    [...el.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join("");
  return ![...document.querySelectorAll("body *")].some((el) => pattern.test(ownText(el).trim()) && shown(el));
}

// After networkidle a detail screen may still paint its loader or an empty form: wait for the data (10 s → INFRA).
async function waitForData(page, screen) {
  const seconds = `${DATA_TIMEOUT_MS / 1000} s`;
  const args = { css: LOADING_CSS, text: LOADING_TEXT.source };
  await page.waitForFunction(noLoaderVisible, args, { timeout: DATA_TIMEOUT_MS, polling: 100 }).catch(() => {
    throw new InfraError(`${screen.id}: still loading after ${seconds}`);
  });
  if (!screen.readySelector) return;
  await page.locator(screen.readySelector).first().waitFor({ state: "visible", timeout: DATA_TIMEOUT_MS }).catch(() => {
    throw new InfraError(`${screen.id}: readySelector ${screen.readySelector} not visible after ${seconds}`);
  });
}

async function clickAndWaitForUrl(page, locator) {
  const before = page.url();
  await locator.click({ timeout: 5000 }).catch(() => {});
  await page.waitForURL((url) => url.href !== before, { timeout: 5000 }).catch(() => {});
  await idle(page);
  return page.url() !== before;
}

async function resolveFirstRow(page) {
  const row = page.locator('[role="row"]:has([role="gridcell"])').first();
  if (!(await row.count())) return false;
  if (await clickAndWaitForUrl(page, row)) return true;
  const action = row.locator(".data-table__action-btn:not(.data-table__action-btn--danger)").first();
  return (await action.count()) > 0 && clickAndWaitForUrl(page, action);
}

// First *visible* match; lists load after the route change, so wait for it.
async function resolveFirstLink(page, css) {
  const link = page.locator(css).filter({ visible: true }).first();
  const found = await link.waitFor({ timeout: 5000 }).then(() => true, () => false);
  return found && clickAndWaitForUrl(page, link);
}

async function resolveLinks(page, screen) {
  for (const [step, css] of screen.links.entries()) {
    if (await resolveFirstLink(page, css)) continue;
    return step === 0 && screen.fallbackRow ? resolveFirstRow(page) : false;
  }
  return true;
}

async function resolveDetail(page, screen) {
  if (screen.resolver === "fixed") return true;
  const resolved = screen.resolver === "first-row" ? await resolveFirstRow(page) : await resolveLinks(page, screen);
  if (resolved) await settle(page);
  return resolved;
}

async function scrollToTiles(page) {
  await page.evaluate(() => {
    const header = document.querySelector(".section-header-row");
    const tiles = [...document.querySelectorAll("*")].find(
      (el) => el.children.length === 0 && /(Kafelki|Tiles) \(1\//.test(el.textContent)
    );
    if (!header || !tiles) throw new Error("scrolled: anchor not found");
    let box = header.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) {
      box = box.parentElement;
    }
    if (box) box.scrollTop += tiles.getBoundingClientRect().top - 240; // desktop: nothing scrolls (r07)
  });
}

async function openFab(page) {
  const fab = page.locator(".floating-actions__trigger:visible").first();
  if (!(await fab.count())) throw new Error("no FAB (.floating-actions__trigger) on this screen");
  await fab.click();
}

// The panel switcher of old is the mobile menu (Figma S3); the desktop sidebar lists every panel already.
async function openMobileMenu(page) {
  const menu = page.locator('[aria-controls="app-mobile-menu"]:visible');
  if (await menu.count()) await menu.click();
}

// The header icon (desktop, while a check fails); a phone opens configuration health from the user menu.
async function openHealth(page) {
  const icon = page.locator('[data-testid="config-health-button"]:visible');
  if (await icon.count()) return icon.first().click();
  await page.locator('[data-fid="user-button"]:visible').click();
  await page.locator('[data-testid="config-health-menu"]').click();
}

const STATES = {
  default: async () => {},
  "switcher-open": openMobileMenu,
  "user-menu-open": (page) => page.locator('[data-fid="user-button"]:visible').click(),
  "notif-open": (page) => page.locator('[data-testid="notif-bell"]:visible').first().click(),
  "health-open": openHealth,
  "fab-open": openFab,
  scrolled: scrollToTiles,
};

// Returns a skip reason for rows whose data the seed may not hold (`needsData`), else null.
async function openScreen(page, screen) {
  track(page);
  await page.clock.setFixedTime(FREEZE);
  await page.goto(screen.route).catch((err) => {
    throw new InfraError(`${screen.route} did not load: ${err.message.split("\n")[0]}`);
  });
  await idle(page);
  await assertLanded(page, screen);
  await settle(page);
  if (!(await resolveDetail(page, screen))) {
    if (screen.needsData) return `${screen.id}: ${screen.note} (not in this seed)`;
    throw new InfraError(`${screen.id}: ${screen.resolver} found no detail on ${screen.route}`);
  }
  await waitForData(page, screen);
  await STATES[screen.state](page);
  await idle(page, 5000);
  return null;
}

function screenById(id) {
  const screen = screens.find((row) => row.id === id);
  if (!screen) throw new Error(`capture-spec.json has no screen "${id}"`);
  return screen;
}

// Opens a spec screen in a fresh context: theme pinned, writes stubbed, probes injected.
async function openPinned({ context, page }, id, theme) {
  await prepareContext(context, { theme });
  await openScreen(page, screenById(id));
  await page.addScriptTag({ path: PROBES });
}

// `storageState` comes from a login at most 3 min old (AUTH_MAX_AGE_MS); `needsAuth: false` opens logged-out screens.
const test = base.test.extend({
  needsAuth: [true, { option: true }],
  storageState: async ({ browser, baseURL, needsAuth }, use) => {
    await use(needsAuth ? await login(browser, baseURL) : undefined);
  },
});

module.exports = {
  test,
  expect: base.expect,
  THEME_VALUES,
  LANG,
  LOCALE,
  API_URL,
  isHealth,
  isNotifications,
  pinPreferences,
  prepareContext,
  idle,
  settle,
  waitForData,
  assertLanded,
  openScreen,
  openPinned,
  PROBES,
};
