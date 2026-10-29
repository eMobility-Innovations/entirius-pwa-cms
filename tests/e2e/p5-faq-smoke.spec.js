const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 Faq smoke (plan 33): the groups list and its first group, the items list and its first item.
 * Read-only: opens lists and details, never saves, sends, confirms or deletes.
 */

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  phone: { width: 390, height: 844 },
};

// The admin profile picks the UI language; accept either locale's text.
const { either: escapedEither } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));

async function openPage(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

async function expectDetail(page) {
  await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
  await expect(page.getByRole('button', { name: either((t) => t.common.save) })).toBeVisible();
  await expect(page.locator('.basic-card .form-grid').first()).toBeVisible();
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 Faq (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('groups list opens the first group', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/faq/groups');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.faq.groups));
      await expect(page.getByRole('group', { name: either((t) => t.faq.filters) })).toBeVisible();
      await expect(page.locator('[data-fid="fab"]')).toBeVisible();

      const firstGroup = page.locator('.group-row').first();
      if (await firstGroup.count()) {
        await firstGroup.focus();
        await page.keyboard.press('Enter');
        await page.waitForURL(/\/faq\/groups\/[^/]+$/);
        await page.waitForLoadState('networkidle');
        await expectDetail(page);
      } else {
        await expect(page.getByText(either((t) => t.faq.no_groups))).toBeVisible();
      }

      collector.assertNoErrors(expect, 'FAQ groups');
    });

    test('items list opens the first item', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/faq/items');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.faq.items));
      await expect(page.locator('[data-fid="fab"]')).toBeVisible();
      await expect(page.locator('.data-table__row, .empty-state').first()).toBeVisible({ timeout: 10000 });

      const firstRow = page.locator('.data-table__row').first();
      if (await firstRow.count()) {
        await firstRow.click();
        await page.waitForURL(/\/faq\/items\/\d+$/);
        await page.waitForLoadState('networkidle');
        await expectDetail(page);
      } else {
        await expect(page.locator('.empty-state').getByText(either((t) => t.faq.no_items))).toBeVisible();
      }

      collector.assertNoErrors(expect, 'FAQ items');
    });
  });
}
