const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 ContactForms smoke (plan 37): submissions, leads and bookings lists, each with its first record. Read-only:
 * opens lists, details, the status menu and the date picker, never saves, changes a status, confirms or deletes.
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

// Opens the first row of the list; false when the stack has none (the list shows its empty state).
async function openFirstRow(page, detailUrl) {
  await expect(page.locator('.data-table__row, .empty-state').first()).toBeVisible({ timeout: 10000 });
  const firstRow = page.locator('.data-table__row').first();
  if (!(await firstRow.count())) return false;
  await firstRow.click();
  await page.waitForURL(detailUrl);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: either((t) => t.common.back) }).first()).toBeVisible();
  return true;
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 ContactForms (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('submissions list opens the first submission', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/forms/list');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.cf.submissions));
      if (await openFirstRow(page, /\/forms\/(?!list$|leads|bookings)[^/]+$/)) {
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.cf.submission_detail));
        await expect(page.getByRole('combobox').first()).toBeVisible();
      }

      collector.assertNoErrors(expect, 'Submissions');
    });

    test('leads list opens the first lead and its status menu', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/forms/leads');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.cf.leads));
      await expect(page.getByRole('group', { name: either((t) => t.cf.status) })).toBeVisible();
      if (await openFirstRow(page, /\/forms\/leads\/[^/]+$/)) {
        await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
        await expect(page.getByRole('button', { name: either((t) => t.cf.save) })).toBeDisabled();
        await expect(page.locator('.basic-card').first()).toBeVisible();
        // Every lead status has another transition (leadStatus.js ALLOWED_NEXT), so the menu is always there.
        const status = page.getByRole('combobox', { name: either((t) => t.cf.change_status) });
        await expect(status).toBeVisible();
        await status.click();
        await expect(page.getByRole('option').first()).toBeVisible();
        await page.keyboard.press('Escape');
      }

      collector.assertNoErrors(expect, 'Leads');
    });

    test('bookings list opens its date picker and the first booking', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/forms/bookings');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.cf.bookings));
      // A phone keeps the filter groups in MobileFilterPanel: open it first.
      const filters = page.getByRole('button', { name: either((t) => t.builder.filters) });
      if (await filters.isVisible()) await filters.click();
      await expect(page.getByRole('group', { name: either((t) => t.cf.lead_status) }).filter({ visible: true })).toBeVisible();
      const from = page.getByRole('button', { name: either((t) => t.cf.date_from) }).filter({ visible: true });
      await from.click();
      await expect(page.locator('.basic-date-picker .flatpickr-calendar').filter({ visible: true }).first()).toBeVisible();
      await from.click();

      if (await openFirstRow(page, /\/forms\/bookings\/[^/]+$/)) {
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.cf.booking_detail));
        await expect(page.locator('.basic-card').first()).toBeVisible();
      }

      collector.assertNoErrors(expect, 'Bookings');
    });
  });
}
