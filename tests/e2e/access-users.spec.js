const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { SUPERUSER } = require('./helpers/users');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');
const { either: escapedEither } = require('./helpers/text');

/**
 * Access plan 23: one login per kind of user and what each sees. The admin (superuser) manages access; the viewer reads
 * without the Access panel, a Save, Delete or New button, and with disabled fields; the editor saves FAQ but not the
 * Pricing settings; a customer meets the no-access wall. The server is the authority: the viewer's own write is refused
 * with the gate envelope, and a burst of refusals shows one toast and refreshes `me` once.
 * Read-only: the only write sent is the viewer's, which the gate refuses before any view runs.
 */

const API = process.env.VUE_APP_API_URL || 'http://localhost:8100';
const CHANNEL = process.env.VUE_APP_CHANNEL || 'default-europe';
// Seeded users (todo/access README § Contract) — dev defaults, never real. The customer has none: the zeno seed gives no
// non-staff account a Customer row on the channel, so the run names one (the login is the email) or the case skips.
const USERS = {
  viewer: [process.env.ACCESS_VIEWER_USERNAME || 'viewer', process.env.ACCESS_VIEWER_PASSWORD || 'viewer123'],
  editor: [process.env.ACCESS_EDITOR_USERNAME || 'editor', process.env.ACCESS_EDITOR_PASSWORD || 'editor123'],
  customer: [process.env.ACCESS_CUSTOMER_USERNAME, process.env.ACCESS_CUSTOMER_PASSWORD],
};
// The seeded FAQ group (capture-spec `faq-group-detail` uses it too).
const FAQ_GROUP = 'shipping';
const FAQ_GROUP_URL = `${API}/api/faq/v2/admin/${CHANNEL}/groups/${FAQ_GROUP}/`;
// The access store refreshes `me` after a refusal at most once per REFRESH_INTERVAL_MS (src/stores/access.js).
const REFRESH_INTERVAL_MS = 5000;
// The three list calls of the FAQ group page: channels and the two item lists.
const FAQ_LISTS = /\/api\/faq\/v2\/admin\/(channels|[^/]+\/items)\/\?/;
const GATE_REFUSAL = {
  error: 'PERMISSION_DENIED',
  message: 'You do not have permission to perform this action.',
  debug_id: '0000e2e0',
  details: [{ field: null, location: 'path', issue: 'ACCESS_DENIED', description: 'needs faq.faq:read' }],
};

const either = (pick) => escapedEither(pick(en), pick(pl));
const sidebar = (page) => page.locator('[data-testid="app-sidebar"]');
const accessEntry = (page) => sidebar(page).getByText(either((t) => t.panels.access), { exact: true });

async function openPage(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

async function bearer(page) {
  const cookie = (await page.context().cookies()).find((c) => c.name === 'token');
  return { Authorization: `Bearer ${cookie.value}` };
}

async function expectReadonlyGroup(page) {
  await expect(page.locator('[data-testid="readonly-notice"]')).toBeVisible();
  await expect(page.getByRole('button', { name: either((t) => t.common.save) })).toHaveCount(0);
  await expect(page.getByRole('button', { name: either((t) => t.common.delete) })).toHaveCount(0);
  const fields = page.locator('.basic-card .form-grid').first().locator('input, textarea, [role="combobox"]');
  await expect(fields.first()).toBeVisible();
  for (const field of await fields.all()) await expect(field).toBeDisabled();
}

test.describe('Access: who sees what (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('admin (superuser) sees and opens the Access panel', async ({ page }) => {
    await login(page, ...SUPERUSER);
    const collector = createErrorCollector(page);
    await expect(accessEntry(page)).toBeVisible();
    await openPage(page, '/access');
    await page.waitForURL(/\/access\/roles$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.access.roles.title));
    collector.assertNoErrors(expect, 'Access admin');
  });

  test('viewer reads PIM and FAQ without the Access panel or any write control', async ({ page }) => {
    await login(page, ...USERS.viewer);
    const collector = createErrorCollector(page);
    await expect(sidebar(page)).toBeVisible();
    await expect(accessEntry(page)).toHaveCount(0);

    await openPage(page, '/pim/products');
    await expect(page.locator('[data-testid="readonly-notice"]')).toBeVisible();
    await expect(page.locator('[data-fid="fab"]')).toHaveCount(0);

    await openPage(page, `/faq/groups/${FAQ_GROUP}`);
    await expectReadonlyGroup(page);

    await openPage(page, '/access/roles');
    await expect(page).not.toHaveURL(/\/access/);
    collector.assertNoErrors(expect, 'Access viewer');
  });

  test('editor saves FAQ but only reads the Pricing settings', async ({ page }) => {
    await login(page, ...USERS.editor);
    const collector = createErrorCollector(page);
    await expect(accessEntry(page)).toHaveCount(0);

    await openPage(page, `/faq/groups/${FAQ_GROUP}`);
    await expect(page.getByRole('button', { name: either((t) => t.common.save) })).toBeVisible();
    await expect(page.locator('[data-testid="readonly-notice"]')).toHaveCount(0);

    await openPage(page, '/pricing/tax-classes');
    await page.locator('a[href^="/pricing/tax-classes/"]:not([href$="/create"])').first().click();
    await page.waitForURL(/\/pricing\/tax-classes\/[^/]+$/);
    // An in-app navigation: the loaded form (its header actions render with it), not `networkidle`.
    await expect(page.locator('.basic-card .form-grid input').first()).toBeDisabled();
    await expect(page.locator('[data-testid="readonly-notice"]')).toBeVisible();
    await expect(page.getByRole('button', { name: either((t) => t.common.save) })).toHaveCount(0);
    collector.assertNoErrors(expect, 'Access editor');
  });

  test('customer meets the no-access wall and logs out', async ({ page }) => {
    const [email, password] = USERS.customer;
    // Runs only when the run names its customer; then a failed login is a broken seed and fails, never a skip. Without
    // one the next test still proves the wall from a real session.
    test.skip(!email, 'no customer named (ACCESS_CUSTOMER_USERNAME = its email, ACCESS_CUSTOMER_PASSWORD)');
    const probe = await page.request.post(`${API}/api/accounts/v1/${CHANNEL}/customer/tokens/`, { data: { email, password } });
    expect(probe.ok(), `the named customer ${email} logs in on ${CHANNEL} (answers ${probe.status()})`).toBe(true);

    await login(page, email, password);
    await expectWall(page);
  });

  test('a non-staff `me` shows the wall instead of the shell', async ({ page }) => {
    // The UI half of the customer case on any seed: a real session whose `me` says `is_staff: false`.
    await page.route('**/api/access/v2/me/', async (route) => {
      const me = await (await route.fetch()).json();
      await route.fulfill({ json: { ...me, user: { ...me.user, is_staff: false }, permissions: {} } });
    });
    await login(page, ...USERS.viewer);
    await expectWall(page);
  });
});

async function expectWall(page) {
  await expect(page.getByText(either((t) => t.access.staff_only_title))).toBeVisible();
  await expect(sidebar(page)).toHaveCount(0);
  await page.locator('[data-testid="staff-only-logout"]').click();
  await expect(page.locator('input[type="password"]')).toBeVisible();
}

test.describe('Access: the server is the authority (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('the viewer’s own Save request is refused by the gate', async ({ page }) => {
    await login(page, ...USERS.viewer);
    const headers = await bearer(page);
    const group = await (await page.request.get(FAQ_GROUP_URL, { headers })).json();
    const { idx, name, channel_ids, is_active } = group;

    const response = await page.request.patch(FAQ_GROUP_URL, { headers, data: { idx, name, channel_ids, is_active } });
    expect(response.status(), 'viewer PATCH of a FAQ group').toBe(403);
    const body = await response.json();
    expect(body.error).toBe('PERMISSION_DENIED');
    expect(body.details.map((d) => d.issue)).toContain('ACCESS_DENIED');
  });

  test('three refusals on one page: one toast, one `me` refresh', async ({ page }) => {
    await page.clock.install();
    await login(page, ...USERS.viewer);
    await openPage(page, '/faq/groups');
    // Past the throttle window of the start-up `me`, so the refusals may refresh it.
    await page.clock.fastForward(REFRESH_INTERVAL_MS + 1000);

    let refused = 0;
    let meCalls = 0;
    page.on('request', (request) => request.url().includes('/api/access/v2/me/') && (meCalls += 1));
    await page.route(FAQ_LISTS, (route) => {
      refused += 1;
      return route.fulfill({ status: 403, json: GATE_REFUSAL });
    });

    // An in-app navigation: `networkidle` resolves at once, so the counts are polled.
    await page.locator('.group-row').first().click();
    await page.waitForURL(/\/faq\/groups\/[^/]+$/);
    await expect.poll(() => refused, { message: 'refused list calls' }).toBe(3);
    // Inside the toast's 5 s life.
    await expect(page.locator('.notification')).toHaveCount(1);
    await expect(page.locator('.notification p')).toHaveText(either((t) => t.access.denied_action));
    await expect.poll(() => meCalls, { message: '`me` calls after the refusals' }).toBe(1);
    await page.waitForLoadState('networkidle');

    expect(refused, 'refused list calls').toBe(3);
    expect(meCalls, '`me` calls after the refusals').toBe(1);
  });
});
