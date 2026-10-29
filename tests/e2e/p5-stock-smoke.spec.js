const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 Stock smoke (plan 38): the stock screen of the first (manual) warehouse, page 2 when there is one, a switch to
 * an integration warehouse and back, and the CSV import dialog opened and closed.
 * Read-only: never edits a quantity, never uploads, never saves. The add-product dialog has no call site in the CMS
 * (nothing opens it), so the smoke cannot reach it.
 */

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  phone: { width: 390, height: 844 },
};

// The admin profile picks the UI language; accept either locale's text.
const { either: escapedEither } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));

async function expectTableLoaded(page) {
  await expect(page.locator('.data-table__row, .empty-state').first()).toBeVisible({ timeout: 10000 });
}

async function pickWarehouse(page, name) {
  await page.getByRole('combobox', { name: either((t) => t.stock.warehouse) }).click();
  await page.getByRole('menuitemradio', { name }).click();
  await page.waitForLoadState('networkidle');
}

async function warehouseNames(page) {
  const combobox = page.getByRole('combobox', { name: either((t) => t.stock.warehouse) });
  await combobox.click();
  const names = await page.getByRole('menuitemradio').allInnerTexts();
  await page.keyboard.press('Escape');
  return names.map((name) => name.trim());
}

async function checkSecondPage(page) {
  const pager = page.getByRole('navigation', { name: 'pagination' });
  if (!(await pager.count())) return;
  const firstSku = await page.locator('.data-table__row').first().innerText();
  await pager.getByRole('button', { name: '2', exact: true }).click();
  await page.waitForLoadState('networkidle');
  await expect(pager.locator('[aria-current="page"]')).toHaveText('2');
  await expect(page.locator('.data-table__row').first()).not.toHaveText(firstSku);
}

async function checkImportDialog(page) {
  const open = () => page.getByRole('button', { name: either((t) => t.stock.import_csv) }).click();
  const dialog = page.getByRole('dialog', { name: either((t) => t.stock.import_title) });
  await open();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: either((t) => t.stock.import_upload) })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await open();
  await dialog.getByRole('button', { name: either((t) => t.common.cancel) }).click();
  await expect(dialog).toBeHidden();
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 Stock (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('stock table pages, switches warehouses and opens the import dialog', async ({ page }) => {
      const collector = createErrorCollector(page);
      await page.goto('/stock/manage');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.stock.manage));
      await expect(page.getByRole('group', { name: either((t) => t.stock.status) })).toBeVisible();
      await expectTableLoaded(page);
      await checkSecondPage(page);

      const names = await warehouseNames(page);
      const manual = names[0];
      const integration = names[names.length - 1];
      if (integration !== manual) {
        await pickWarehouse(page, integration);
        await expectTableLoaded(page);
        await expect(page.getByText(either((t) => t.stock.integration_readonly))).toBeVisible();
        await pickWarehouse(page, manual);
        await expectTableLoaded(page);
      }

      await expect(page.getByRole('button', { name: either((t) => t.stock.save_all) })).toBeDisabled();
      await checkImportDialog(page);

      collector.assertNoErrors(expect, 'Stock');
    });
  });
}
