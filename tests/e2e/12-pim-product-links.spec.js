/**
 * PIM Linked products — LIVE backend integration spec.
 *
 * Exercises the new "Linked products" tab in ProductDetail.vue end-to-end:
 *   - real `login()` form submission
 *   - real /api/pim/v2/admin/* endpoints (no mocks)
 *   - real Postgres backing the ProductLink/ProductLinkType tables
 *
 * Pre-conditions:
 *   1. Backend up:    make dev (or make up)
 *   2. PIM seeded:    products with SKUs 1100-69 and 1310-31 exist in channel england
 *   3. ProductLinkType rows seeded: related/crosssell/upsell/navigation
 *
 * Cleanup happens via API in beforeEach/afterEach so tests are idempotent and
 * safe to re-run. Tests run sequentially (single worker) because they share
 * DB state on a single product.
 *
 * Usage:
 *   npm run test:e2e -- 12-pim-product-links.spec.js
 */

const { test, expect, request } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const { escapeRegExp } = require('./helpers/text');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

// The admin profile picks the UI language: a name matches either locale's text (a substring, as Playwright's
// default string match — a tab name carries its count).
const inEither = (pick) => new RegExp(`${escapeRegExp(pick(en))}|${escapeRegExp(pick(pl))}`, 'i');

const API_BASE = process.env.VUE_APP_API_URL || 'http://localhost:8000';
const CHANNEL = 'england';
const PRODUCT_SKU = '1100-69';
const LINKED_SKU = '1310-31';

test.describe.configure({ mode: 'serial' });

async function getJwt() {
  const ctx = await request.newContext();
  const user = process.env.VUE_APP_USERNAME || 'admin';
  const pass = process.env.VUE_APP_PASSWORD || 'admin';
  const res = await ctx.post(`${API_BASE}/api/token/`, {
    data: { username: user, password: pass },
  });
  expect(res.ok(), `JWT login failed: ${res.status()}`).toBeTruthy();
  const { access } = await res.json();
  await ctx.dispose();
  return access;
}

async function deleteAllLinks(jwt) {
  const ctx = await request.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${jwt}` },
  });
  const listRes = await ctx.get(
    `${API_BASE}/api/pim/v2/admin/${CHANNEL}/products/${PRODUCT_SKU}/links/?page_size=100`
  );
  if (!listRes.ok()) {
    await ctx.dispose();
    return;
  }
  const { results } = await listRes.json();
  for (const link of results || []) {
    await ctx.delete(
      `${API_BASE}/api/pim/v2/admin/${CHANNEL}/products/${PRODUCT_SKU}/links/${link.pk}/`
    );
  }
  await ctx.dispose();
}

async function openLinkedProductsTab(page) {
  await page.goto(`/pim/products/${PRODUCT_SKU}`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  // Click the "Linked products" tab via its label
  await page.getByRole('tab', { name: inEither((t) => t.pim.tab_links) }).click();
  await page.waitForSelector('[data-testid="linked-create-btn"]', { timeout: 5000 });
}

let jwt;

test.beforeAll(async () => {
  jwt = await getJwt();
});

test.beforeEach(async ({ page }) => {
  await deleteAllLinks(jwt);
  await login(page);
});

test.afterEach(async () => {
  await deleteAllLinks(jwt);
});

test.describe('PIM Linked products', () => {
  test('1. tab renders empty state, filter, sync notice', async ({ page }) => {
    const collector = createErrorCollector(page);
    await openLinkedProductsTab(page);

    // Sync notice visible
    await expect(page.locator('[data-testid="linked-sync-notice"]')).toBeVisible();

    // SegmentedControl filter: All + 4 link types
    await expect(page.locator('[data-testid="linked-filter-all"]')).toBeVisible();
    await expect(page.locator('[data-testid="linked-filter-related"]')).toBeVisible();
    await expect(page.locator('[data-testid="linked-filter-crosssell"]')).toBeVisible();
    await expect(page.locator('[data-testid="linked-filter-upsell"]')).toBeVisible();
    await expect(page.locator('[data-testid="linked-filter-navigation"]')).toBeVisible();

    // Empty state — no data rows
    const rowCount = await page.locator('[data-testid="linked-row"]').count();
    expect(rowCount).toBe(0);

    collector.assertNoErrors(expect, 'Linked products empty state');
  });

  test('2. create link via drawer adds row to table', async ({ page }) => {
    await openLinkedProductsTab(page);
    await page.locator('[data-testid="linked-create-btn"]').click();
    await page.waitForSelector('.side-drawer-panel', { timeout: 3000 });

    // Open SKU picker
    await page
      .locator('[data-testid="linked-form-sku"]')
      .getByRole('combobox')
      .click();
    // Type a search term that matches the linked SKU (the picker panel opens in a popover)
    const skuInput = page.getByRole('combobox', { name: inEither((t) => t.pim.links.linked_sku_placeholder) });
    await skuInput.fill('1310');
    // Wait for picker debounce + API + render
    const firstOption = page.getByRole('option').first();
    await firstOption.waitFor({ state: 'visible', timeout: 5000 });
    await firstOption.click();

    // Open Type select and pick "Related"
    await page
      .locator('[data-testid="linked-form-type"]')
      .getByRole('combobox')
      .click();
    await page.getByRole('option', { name: inEither((t) => t.pim.links.type_related) }).first().click();

    // Submit
    await page.locator('[data-testid="linked-form-submit"]').click();

    // Drawer should close + row should appear
    await page.waitForSelector('.side-drawer-panel', { state: 'detached', timeout: 5000 });
    await expect(page.locator('[data-testid="linked-row"]', { hasText: LINKED_SKU })).toBeVisible({
      timeout: 5000,
    });
  });

  test('3. submitting empty form shows validation error', async ({ page }) => {
    await openLinkedProductsTab(page);
    await page.locator('[data-testid="linked-create-btn"]').click();
    await page.waitForSelector('.side-drawer-panel', { timeout: 3000 });

    // Submit without picking a SKU
    await page.locator('[data-testid="linked-form-submit"]').click();

    // Drawer stays open, field error appears
    await expect(page.locator('.side-drawer-panel')).toBeVisible();
    await expect(
      page.locator('.side-drawer-panel').getByRole('alert').first()
    ).toBeVisible({ timeout: 2000 });
  });

  test('4. edit link updates position', async ({ page }) => {
    // Pre-seed one link via API
    const ctx = await request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${jwt}` },
    });
    const seedRes = await ctx.post(
      `${API_BASE}/api/pim/v2/admin/${CHANNEL}/products/${PRODUCT_SKU}/links/`,
      {
        data: {
          linked_product_sku: LINKED_SKU,
          link_type_idx: 'related',
          position: 0,
        },
      }
    );
    expect(seedRes.ok(), `seed failed: ${seedRes.status()}`).toBeTruthy();
    const { pk } = await seedRes.json();
    await ctx.dispose();

    await openLinkedProductsTab(page);

    // Click edit on the seeded row
    await page.locator(`[data-testid="linked-edit-${pk}"]`).click();
    await page.waitForSelector('.side-drawer-panel', { timeout: 3000 });

    // SKU picker should be disabled (chip mode, no edit)
    const posInput = page.locator('[data-testid="linked-form-position"] input');
    await posInput.fill('5');

    await page.locator('[data-testid="linked-form-submit"]').click();
    await page.waitForSelector('.side-drawer-panel', { state: 'detached', timeout: 5000 });

    // Row should still show LINKED_SKU and position 5
    const row = page.locator('[data-testid="linked-row"]', { hasText: LINKED_SKU });
    await expect(row).toBeVisible();
    await expect(row).toContainText('5');
  });

  test('5. filter by link type narrows results', async ({ page }) => {
    // Pre-seed: one related + one upsell
    const ctx = await request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${jwt}` },
    });
    await ctx.post(
      `${API_BASE}/api/pim/v2/admin/${CHANNEL}/products/${PRODUCT_SKU}/links/`,
      { data: { linked_product_sku: LINKED_SKU, link_type_idx: 'related', position: 0 } }
    );
    await ctx.post(
      `${API_BASE}/api/pim/v2/admin/${CHANNEL}/products/${PRODUCT_SKU}/links/`,
      { data: { linked_product_sku: LINKED_SKU, link_type_idx: 'upsell', position: 0 } }
    );
    await ctx.dispose();

    await openLinkedProductsTab(page);

    // All shows 2 rows
    await page.locator('[data-testid="linked-filter-all"]').click();
    await page.waitForLoadState('networkidle');
    expect(await page.locator('[data-testid="linked-row"]').count()).toBe(2);

    // Related shows 1
    await page.locator('[data-testid="linked-filter-related"]').click();
    await page.waitForLoadState('networkidle');
    expect(await page.locator('[data-testid="linked-row"]').count()).toBe(1);

    // Upsell shows 1
    await page.locator('[data-testid="linked-filter-upsell"]').click();
    await page.waitForLoadState('networkidle');
    expect(await page.locator('[data-testid="linked-row"]').count()).toBe(1);

    // Crosssell shows 0
    await page.locator('[data-testid="linked-filter-crosssell"]').click();
    await page.waitForLoadState('networkidle');
    expect(await page.locator('[data-testid="linked-row"]').count()).toBe(0);
  });

  test('7. drag-and-drop reorder updates positions (filtered view)', async ({ page }) => {
    // Pre-seed 3 related links with positions 1, 2, 3 against different linked SKUs.
    // Use any 3 SKUs that exist in the england channel.
    const ctx = await request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${jwt}` },
    });
    // Pick candidates likely present (mirrors fixture data in this seed).
    const candidates = ['1310-31', '1320-31', '140-07', '143005R'];
    const seeded = [];
    for (const lsku of candidates) {
      const res = await ctx.post(
        `${API_BASE}/api/pim/v2/admin/${CHANNEL}/products/${PRODUCT_SKU}/links/`,
        { data: { linked_product_sku: lsku, link_type_idx: 'related', position: seeded.length + 1 } }
      );
      if (res.ok()) seeded.push({ lsku, pk: (await res.json()).pk });
      if (seeded.length === 3) break;
    }
    await ctx.dispose();
    expect(seeded.length).toBeGreaterThanOrEqual(2);

    await openLinkedProductsTab(page);

    // Switch to Related filter to enable drag
    await page.locator('[data-testid="linked-filter-related"]').click();
    await page.waitForLoadState('networkidle');

    // Capture initial order
    const rowsBefore = await page
      .locator('[data-testid="linked-row"]')
      .allTextContents();
    expect(rowsBefore.length).toBe(seeded.length);

    // Drag first handle onto the last row using Playwright's real-mouse drag
    const firstHandle = page
      .locator('[data-testid="linked-row"] [data-testid="linked-handle"]')
      .first();
    const lastRow = page
      .locator('[data-testid="linked-row"]')
      .last();
    await firstHandle.dragTo(lastRow);

    // Wait for PATCH requests to settle
    await page.waitForLoadState('networkidle', { timeout: 5000 });

    const rowsAfter = await page
      .locator('[data-testid="linked-row"]')
      .allTextContents();
    // First row should no longer be the one that was first
    expect(rowsAfter[0]).not.toBe(rowsBefore[0]);
  });

  test('6. delete link with confirmation removes row', async ({ page }) => {
    // Pre-seed
    const ctx = await request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${jwt}` },
    });
    const seedRes = await ctx.post(
      `${API_BASE}/api/pim/v2/admin/${CHANNEL}/products/${PRODUCT_SKU}/links/`,
      { data: { linked_product_sku: LINKED_SKU, link_type_idx: 'related', position: 0 } }
    );
    const { pk } = await seedRes.json();
    await ctx.dispose();

    await openLinkedProductsTab(page);

    // Click delete trigger
    await page.locator(`[data-testid="linked-delete-${pk}"]`).click();

    // Confirmation dialog — accept it.
    await page.locator('[data-testid="confirm-dialog-confirm"]').click();

    // Row disappears
    await expect(page.locator('[data-testid="linked-row"]')).toHaveCount(0, { timeout: 5000 });
  });
});
