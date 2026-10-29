const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 Promo smoke (plan 44): the discount list and its first rule (the filter drawer opened and closed), the voucher
 * list and its first voucher. Read-only: never saves, reveals, confirms or deletes. Without the checkout_voucher module
 * the list has no Vouchers switch and the voucher test skips.
 */

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  phone: { width: 390, height: 844 },
};

// The admin profile picks the UI language; accept either locale's text.
const { either: escapedEither } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));
const h1 = (page) => page.getByRole('heading', { level: 1 });

async function openPage(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

// Opens the first row; false when the stack has none (the list shows its empty state).
async function openFirst(page, detailUrl) {
  const rows = page.locator('.data-table__row');
  await expect(rows.first().or(page.locator('.empty-state').first())).toBeVisible({ timeout: 10000 });
  if (!(await rows.count())) return false;
  await rows.first().click();
  await page.waitForURL(detailUrl);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: either((t) => t.common.back) }).first()).toBeVisible();
  await expect(h1(page)).not.toBeEmpty();
  return true;
}

// Opens the first filter's drawer (or the new-filter drawer of the first kind) and closes it without saving.
async function openAndCloseFilterDrawer(page) {
  const title = page.getByRole('heading', { name: either((t) => t.promo.section_filters) });
  const filters = page.locator('.basic-card').filter({ has: title });
  const edit = filters.getByRole('button', { name: either((t) => t.common.edit) });
  const add = filters.getByRole('button', { name: either((t) => t.promo.add_filter) });
  const opener = (await edit.count()) ? edit.first() : add.first();
  await opener.click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: either((t) => t.common.save) })).toBeVisible();
  await drawer.getByRole('button', { name: either((t) => t.common.cancel) }).click();
  await expect(drawer).toHaveCount(0);
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 Promo (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('discount list opens the first rule and its filter drawer', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/promo/list');

      await expect(h1(page)).toHaveText(either((t) => t.nav.promo_list));
      // The filter groups sit inline on a desktop and behind the MobileFilterPanel trigger on a phone.
      const trigger = page.getByRole('button', { name: either((t) => t.builder.filters) });
      const allChip = page.getByRole('button', { name: either((t) => t.promo.filter_all) });
      await expect(trigger.or(allChip).first()).toBeVisible();
      await expect(page.locator('[data-fid="fab"]')).toBeVisible();

      if (await openFirst(page, /\/promo\/\d+$/)) {
        const actions = page.getByRole('group', { name: either((t) => t.common.actions) });
        await expect(actions.getByRole('button', { name: either((t) => t.common.save) })).toBeVisible();
        await expect(actions.getByRole('button', { name: either((t) => t.common.delete) })).toBeVisible();
        await openAndCloseFilterDrawer(page);
      }

      collector.assertNoErrors(expect, 'Promo');
    });

    test('voucher list opens the first voucher', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/promo/list');

      await expect(h1(page)).toHaveText(either((t) => t.nav.promo_list));
      const vouchers = page.getByRole('button', { name: either((t) => t.promo.tab_vouchers), exact: true });
      test.skip(!(await vouchers.count()), 'checkout_voucher module is off on this stack');
      await vouchers.click();

      if (await openFirst(page, /\/promo\/voucher\/\d+$/)) {
        await expect(page.getByRole('button', { name: either((t) => t.promo.voucher_reveal_btn) })).toBeVisible();
      }

      collector.assertNoErrors(expect, 'Vouchers');
    });
  });
}
