const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');

/**
 * FIX-09: the D7 gaps of the read-only mode. A deep link opened before login is guarded for the user who logs in; the
 * controls outside a FormField (switches, inputs that save on blur, drag lists) follow a read-only page; a product's
 * prices and stock tabs work on their own areas (read-only for the editor, gone for a role without them); a role without
 * `munin.config` never polls the configuration health. The server refuses all of it anyway — this is what the UI shows.
 * Writes: one custom role and its grant to `norole`, created and removed here through the API.
 */

const API = process.env.VUE_APP_API_URL || 'http://localhost:8100';
// Seeded users (todo/access README § Contract) — dev defaults, never real.
const USERS = {
  viewer: [process.env.ACCESS_VIEWER_USERNAME || 'viewer', process.env.ACCESS_VIEWER_PASSWORD || 'viewer123'],
  editor: [process.env.ACCESS_EDITOR_USERNAME || 'editor', process.env.ACCESS_EDITOR_PASSWORD || 'editor123'],
  norole: [process.env.ACCESS_NOROLE_USERNAME || 'norole', process.env.ACCESS_NOROLE_PASSWORD || 'norole123'],
  admin: [process.env.ACCESS_ADMIN_USERNAME || 'accessadmin', process.env.ACCESS_ADMIN_PASSWORD || 'accessadmin123'],
};
const ACCESS_ADMIN = `${API}/api/access/v2/admin`;
const CHANNEL = process.env.VUE_APP_CHANNEL || 'default-europe';
const QMS_ADMIN = `${API}/api/qms/v2/admin`;
const PIM_ADMIN = `${API}/api/pim/v2/admin/${CHANNEL}`;
const PIM_LIST = /\/api\/pim\/v2\/admin\/[^/]+\/products\/\?/;
const CONFIG_HEALTH = /\/api\/munin\/v2\/health\//;
// The poll runs every 30 s (src/stores/configHealth.js); one period and a margin.
const HEALTH_WINDOW_MS = 35000;

async function openPage(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

// The login form of the wall the current page shows (tests/helpers/auth.js opens `/` first; a deep link must not).
async function signIn(page, [username, password]) {
  await page.locator('input[name="username"], input[type="text"]').first().fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.click('button:has-text("Zaloguj"), button:has-text("Log in")');
  await page.waitForLoadState('networkidle');
}

// vuedraggable binds a Sortable to the list element; the instance sits on it under a `Sortable<timestamp>` key.
function sortableDisabled(item) {
  return item.evaluate((el) => {
    for (let node = el; node; node = node.parentElement) {
      const key = Object.keys(node).find((k) => k.startsWith('Sortable'));
      if (key) return node[key].options.disabled;
    }
    return null;
  });
}

async function bearer(page) {
  const cookie = (await page.context().cookies()).find((c) => c.name === 'token');
  return { Authorization: `Bearer ${cookie.value}` };
}

async function openFirstProduct(page) {
  await openPage(page, '/pim/products');
  await page.locator('.data-table__row').first().click();
  await expect(page).toHaveURL(/\/pim\/products\/.+/);
  await expect(page.locator('#pim-product-tab-attributes')).toBeVisible();
}

// A SKU with a row in a manual warehouse: its stock tab has a quantity field to check.
async function manualStockSku(page) {
  const headers = await bearer(page);
  const warehouses = await (await page.request.get(`${QMS_ADMIN}/warehouses/`, { headers })).json();
  const manual = warehouses.find((warehouse) => warehouse.source_type === 'manual');
  expect(manual, 'the seed has a manual warehouse').toBeTruthy();
  const stock = await (await page.request.get(`${QMS_ADMIN}/warehouses/${manual.code}/stock/`, { headers })).json();
  // BDD leaves stock rows for SKUs that are not PIM products (BDD-QMS-001); the product page needs a real one.
  for (const { sku } of stock.results) {
    const product = await page.request.get(`${PIM_ADMIN}/products/${encodeURIComponent(sku)}/`, { headers });
    if (product.ok()) return sku;
  }
  throw new Error(`no PIM product among the stock rows of ${manual.code}`);
}

test.describe('Access read-only gaps (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('a PIM deep link opened before login is guarded for the user who logs in', async ({ page }) => {
    let pimListCalls = 0;
    page.on('request', (request) => PIM_LIST.test(request.url()) && (pimListCalls += 1));
    await page.goto('/pim/products');
    await page.waitForSelector('input[type="password"]');

    await signIn(page, USERS.norole);

    await expect(page).not.toHaveURL(/\/pim/);
    await expect(page.locator('[data-testid="app-sidebar"]')).toBeVisible();
    expect(pimListCalls, 'the PIM list never renders for norole').toBe(0);
  });

  test('viewer: lead type switches and labels, stage labels and both drag lists are disabled', async ({ page }) => {
    await login(page, ...USERS.viewer);

    await openPage(page, '/leads/settings/lead-types');
    await expect(page.locator('[data-testid="readonly-notice"]')).toBeVisible();
    const switches = page.getByRole('switch');
    await expect(switches.first()).toBeVisible();
    for (const control of await switches.all()) await expect(control).toBeDisabled();
    for (const label of await page.locator('[data-testid="lead-type-label"] input, input[data-testid="lead-type-label"]').all()) {
      await expect(label).toBeDisabled();
    }

    await openPage(page, '/leads/settings/stages');
    const stage = page.locator('[data-testid="stage-row"]').first();
    await expect(stage).toBeVisible();
    expect(await sortableDisabled(stage), 'stage drag').toBe(true);
    for (const label of await page.locator('[data-testid="stage-row"] input').all()) await expect(label).toBeDisabled();

    await openPage(page, '/faq/groups');
    const group = page.locator('.group-row').first();
    await expect(group).toBeVisible();
    expect(await sortableDisabled(group), 'FAQ group drag').toBe(true);
  });

  test('editor: the product page is editable, its prices and stock tabs are read-only', async ({ page }) => {
    await login(page, ...USERS.editor);
    await openPage(page, `/pim/products/${encodeURIComponent(await manualStockSku(page))}`);
    await expect(page.locator('#pim-product-tab-attributes')).toBeVisible();
    await expect(page.locator('[data-testid="readonly-notice"]')).toHaveCount(0);

    await page.locator('#pim-product-tab-pricing').click();
    const pricing = page.locator('#pim-product-panel-pricing');
    await expect(pricing.locator('[data-testid="readonly-notice"]')).toBeVisible();

    await page.locator('#pim-product-tab-stock').click();
    const stock = page.locator('#pim-product-panel-stock');
    await expect(stock.locator('input').first()).toBeVisible();
    for (const field of await stock.locator('input').all()) await expect(field).toBeDisabled();
  });
});

test.describe('Access read-only gaps: a custom role with PIM read only (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test.describe.configure({ mode: 'serial' });

  let headers;
  let role;
  let grant;

  test.beforeAll(async ({ request }) => {
    const token = await request.post(`${API}/api/token/`, { data: { username: USERS.admin[0], password: USERS.admin[1] } });
    expect(token.ok(), 'accessadmin logs in').toBe(true);
    const body = await token.json();
    headers = { Authorization: `Bearer ${(body.data || body).access}` };
    const staff = await (await request.get(`${ACCESS_ADMIN}/staff/?search=${USERS.norole[0]}`, { headers })).json();
    const user = staff.results.find((row) => row.username === USERS.norole[0]);
    const created = await request.post(`${ACCESS_ADMIN}/roles/`, {
      headers,
      data: { key: `e2e-fix09-${Date.now()}`, name: 'e2e FIX-09 PIM reader', description: '', permissions: ['pim.products:read'] },
    });
    expect(created.ok(), 'custom role created').toBe(true);
    role = await created.json();
    const granted = await request.post(`${ACCESS_ADMIN}/grants/`, { headers, data: { role: role.key, user_id: user.id } });
    expect(granted.ok(), 'role granted to norole').toBe(true);
    grant = await granted.json();
  });

  test.afterAll(async ({ request }) => {
    if (grant) await request.delete(`${ACCESS_ADMIN}/grants/${grant.id}/`, { headers });
    if (role) await request.delete(`${ACCESS_ADMIN}/roles/${role.id}/`, { headers });
  });

  test('a product shows no prices or stock tab without read on them', async ({ page }) => {
    await login(page, ...USERS.norole);
    await openFirstProduct(page);
    await expect(page.locator('#pim-product-tab-pricing')).toHaveCount(0);
    await expect(page.locator('#pim-product-tab-stock')).toHaveCount(0);
  });

  test('no configuration-health request without `munin.config`', async ({ page }) => {
    test.setTimeout(HEALTH_WINDOW_MS + 60000);
    let healthCalls = 0;
    page.on('request', (request) => CONFIG_HEALTH.test(request.url()) && (healthCalls += 1));
    await login(page, ...USERS.norole);
    await expect(page.locator('[data-testid="app-sidebar"]')).toBeVisible();
    await page.waitForTimeout(HEALTH_WINDOW_MS);
    expect(healthCalls, 'config-health polls').toBe(0);
  });
});
