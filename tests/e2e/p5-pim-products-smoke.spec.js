const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 Pim products smoke (plan 49): the product list with the channel selector in the header, the first product with
 * its "more" menu and every tab, the create form. Read-only: never saves, confirms or deletes.
 */

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  phone: { width: 390, height: 844 },
};

// A product without a stock record answers 404 in the Stock tab (the tab shows its empty state).
const NO_STOCK = ({ status, url }) => status === 404 && url.includes('/stock-by-sku/');

// The admin profile picks the UI language; accept either locale's text.
const { either: escapedEither } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));
const h1 = (page) => page.getByRole('heading', { level: 1 });

async function openPage(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

async function expectHeader(page) {
  await expect(h1(page)).not.toBeEmpty();
  await expect(page.getByTestId('pim-channel-select')).toBeVisible();
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 Pim products (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('product list: header channel selector, filters, the first product opens', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/pim/products');

      await expect(h1(page)).toHaveText(either((t) => t.pim.products));
      await expectHeader(page);
      if (name === 'phone') {
        await expect(page.getByRole('button', { name: either((t) => t.pim.filters) })).toBeVisible();
      } else {
        await expect(page.getByRole('combobox', { name: either((t) => t.pim.visibility) })).toBeVisible();
      }

      const rows = page.locator('.page-layout .data-table__row');
      await expect(rows.first().or(page.locator('.empty-state').first())).toBeVisible({ timeout: 10000 });
      if (await rows.count()) {
        await rows.first().click();
        await page.waitForURL(/\/pim\/products\/.+/);
        await page.waitForLoadState('networkidle');
        await expectHeader(page);
      }

      collector.assertNoErrors(expect, 'Pim product list');
    });

    test('product detail: more menu, every tab, no toolbar strip for the channel', async ({ page }) => {
      const collector = createErrorCollector(page, { ignoreNetwork: NO_STOCK });
      await openPage(page, '/pim/products');
      const rows = page.locator('.page-layout .data-table__row');
      await expect(rows.first().or(page.locator('.empty-state').first())).toBeVisible({ timeout: 10000 });
      test.skip(!(await rows.count()), 'no products in the stack');
      await rows.first().click();
      await page.waitForURL(/\/pim\/products\/.+/);
      await page.waitForLoadState('networkidle');

      await expectHeader(page);
      await expect(page.getByRole('button', { name: either((t) => t.common.save) })).toBeVisible();
      await expect(page.locator('.basic-card .form-grid').first()).toBeVisible();
      await expect(page.locator('.pim-channel-selector')).toHaveCount(0);

      await page.getByTestId('pim-product-more').click();
      const menu = page.getByRole('menu');
      await expect(menu.getByRole('menuitem', { name: either((t) => t.pim.channels) })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();

      const tabs = page.getByRole('tab');
      const count = await tabs.count();
      for (let i = 0; i < count; i += 1) {
        await tabs.nth(i).click();
        await expect(page.getByRole('tabpanel')).toBeVisible();
      }

      collector.assertNoErrors(expect, 'Pim product detail');
    });

    test('create form: the detail pattern with Save in the header', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/pim/products/create');

      await expect(h1(page)).toHaveText(either((t) => t.pim.create_product));
      await expectHeader(page);
      await expect(page.getByRole('button', { name: either((t) => t.common.save) })).toBeVisible();
      await expect(page.locator('.basic-card .form-grid').first()).toBeVisible();
      await expect(page.locator('.basic-card .form-field .required')).toHaveCount(2);

      collector.assertNoErrors(expect, 'Pim product create');
    });
  });
}
