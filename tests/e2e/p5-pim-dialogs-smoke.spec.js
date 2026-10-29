const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 Pim dialogs smoke (plan 50): the product's channel dialog, the one translate dialog from the
 * Translation panel („Tłumacz sklep”: the store-wide translation lives there alone, no Pim view offers it), the
 * product list selection and the Pages content list („Przetłumacz wszystko”).
 * Read-only: every dialog is opened, checked and cancelled; nothing is estimated, added or translated.
 */

// A product without a stock record answers 404 in the Stock tab.
const NO_STOCK = ({ status, url }) => status === 404 && url.includes('/stock-by-sku/');
// A PIM without the system language list answers 404; the dialog then names languages by their code (non-critical).
const NO_SYSTEM_LANGUAGES = ({ status, url }) => status === 404 && url.includes('/pim/v2/admin/languages/');

const { either: escapedEither } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));

async function openPage(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

async function expectDialogThenCancel(page, title) {
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: either((t) => t.common.cancel) }).click();
  await expect(dialog).toBeHidden();
}

async function expectTranslateDialog(page, title) {
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: either((t) => t.translate_dialog.source_language) })).toBeVisible();
  await expect(dialog.getByTestId('translate-dialog-estimate')).toBeDisabled();
  await dialog.getByRole('button', { name: either((t) => t.common.cancel) }).click();
  await expect(dialog).toBeHidden();
}

// „Tłumacz sklep” by its name and by the test id it had in the Pim header: either one on a Pim view is a regression.
const storeTranslation = (page) =>
  page
    .getByRole('button', { name: either((t) => t.pim.translate_store) })
    .or(page.getByTestId('pim-translate-store'))
    .or(page.getByTestId('translation-translate-store'));

// The Translation panel's Translate Store (primary action of its header); it waits for the module registry and
// never comes without pim_translator.
async function openTranslationPanel(page) {
  await openPage(page, '/translation-jobs');
  const store = page.getByTestId('translation-translate-store');
  await store.waitFor({ timeout: 5000 }).catch(() => {});
  return store;
}

async function openFirstProduct(page) {
  await openPage(page, '/pim/products');
  const rows = page.locator('.page-layout .data-table__row');
  await expect(rows.first().or(page.locator('.empty-state').first())).toBeVisible({ timeout: 10000 });
  test.skip(!(await rows.count()), 'no products in the stack');
  return rows;
}

test.describe('P5 Pim dialogs', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('product detail: channel presence dialog', async ({ page }) => {
    const collector = createErrorCollector(page, { ignoreNetwork: NO_STOCK });
    const rows = await openFirstProduct(page);
    await rows.first().click();
    await page.waitForURL(/\/pim\/products\/.+/);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('pim-product-more').click();
    await page.getByRole('menuitem', { name: either((t) => t.pim.channels) }).click();
    await expect(page.getByTestId('pim-add-to-channel-dialog')).toBeVisible();
    await expectDialogThenCancel(page, either((t) => t.pim.channel_presence));

    collector.assertNoErrors(expect, 'Pim product dialogs');
  });

  test('translate dialog: the store from the Translation panel', async ({ page }) => {
    const collector = createErrorCollector(page, { ignoreNetwork: NO_SYSTEM_LANGUAGES });
    const store = await openTranslationPanel(page);
    test.skip(!(await store.count()), 'pim_translator is not installed');

    await store.click();
    await expectTranslateDialog(page, either((t) => t.pim.translate_store));

    collector.assertNoErrors(expect, 'Translation store dialog');
  });

  test('translate dialog: the selection from the product list', async ({ page }) => {
    const collector = createErrorCollector(page, { ignoreNetwork: NO_SYSTEM_LANGUAGES });
    const installed = await openTranslationPanel(page);
    test.skip(!(await installed.count()), 'pim_translator is not installed');
    const rows = await openFirstProduct(page);

    await rows.first().locator('input[type="checkbox"], [role="checkbox"]').first().click();
    await page.getByRole('button', { name: either((t) => t.pim.translate) }).first().click();
    await expectTranslateDialog(page, /1/);

    collector.assertNoErrors(expect, 'Pim translate dialog');
  });

  test('the store-wide translation is not on the product list or a product', async ({ page }) => {
    const collector = createErrorCollector(page, { ignoreNetwork: NO_STOCK });
    const offered = await openTranslationPanel(page);
    test.skip(!(await offered.count()), 'pim_translator is not installed: nothing to keep out of the Pim views');

    const rows = await openFirstProduct(page);
    await expect(storeTranslation(page)).toHaveCount(0);
    await rows.first().click();
    await page.waitForURL(/\/pim\/products\/.+/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('pim-product-more')).toBeVisible();
    await expect(storeTranslation(page)).toHaveCount(0);

    collector.assertNoErrors(expect, 'Pim views without the store-wide translation');
  });

  test('translate dialog: every page from the Pages content list', async ({ page }) => {
    const collector = createErrorCollector(page);
    await openPage(page, '/pages/content');
    const translateAll = page.getByRole('button', { name: either((t) => t.builder.translate_all) });
    // The button waits for the module registry; without contentdb_translator it never comes.
    await translateAll.waitFor({ timeout: 5000 }).catch(() => {});
    test.skip(!(await translateAll.count()), 'contentdb_translator is not installed');

    await translateAll.click();
    await expectTranslateDialog(page, either((t) => t.builder.translate_all));

    collector.assertNoErrors(expect, 'Pages translate dialog');
  });
});
