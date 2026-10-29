const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 pilot A smoke (plan 31): the customers list and its first customer, the translation jobs list.
 * Read-only: opens lists and a detail, never saves, sends, confirms or deletes.
 */

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  phone: { width: 390, height: 844 },
};

// The jobs list reads the AI toolbox through the translator modules' bulk/jobs/ endpoint; a stack whose toolbox
// refuses the call answers 502 there, and the page must still render its frame and an empty state. Only that named
// endpoint's 502 is dropped — any other status or URL still fails the test.
const TRANSLATION_JOBS_URL = '/bulk/jobs/';
function ignoreToolboxJobsRefusal({ status, url }) {
  return status === 502 && url.includes(TRANSLATION_JOBS_URL);
}

// The admin profile picks the UI language; accept either locale's text.
const { either: escapedEither } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));

async function openPage(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

async function expectListOrEmpty(page) {
  await expect(page.locator('.data-table__row, .empty-state').first()).toBeVisible({ timeout: 10000 });
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 pilot A (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('customers list opens the first customer', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/accounts/customers');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.accounts.customers));
      await expect(page.getByRole('group', { name: either((t) => t.accounts.filters) })).toBeVisible();
      await expectListOrEmpty(page);

      const firstRow = page.locator('.data-table__row').first();
      if (await firstRow.count()) {
        await firstRow.click();
        await page.waitForURL(/\/accounts\/customers\/[^/]+$/);
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
        await expect(page.getByRole('button', { name: either((t) => t.common.back) }).first()).toBeVisible();
      }

      collector.assertNoErrors(expect, 'Customers');
    });

    test('translation jobs list renders', async ({ page }) => {
      const collector = createErrorCollector(page, {
        ignoreNetwork: ignoreToolboxJobsRefusal,
      });
      await openPage(page, '/translation-jobs');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.translation.jobs));
      await expect(page.getByRole('button', { name: either((t) => t.translation.refresh) })).toBeVisible();
      await expect(page.getByRole('group', { name: either((t) => t.translation.filters) })).toBeVisible();
      await expectListOrEmpty(page);

      collector.assertNoErrors(expect, 'Translation jobs');
    });
  });
}
