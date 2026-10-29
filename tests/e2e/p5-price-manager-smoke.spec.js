const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 PriceManager smoke (plan 39): prices, tax classes and channels, each with its first record. Read-only: opens
 * lists, details, the channel menu and a promo date picker, never saves, syncs, confirms or deletes.
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

// Opens the first record through `rows`; false when the stack has none (the list shows its empty state).
async function openFirst(page, rows, empty, detailUrl) {
  await expect(rows.first().or(empty.first())).toBeVisible({ timeout: 10000 });
  if (!(await rows.count())) return false;
  await rows.first().click();
  await page.waitForURL(detailUrl);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: either((t) => t.common.back) }).first()).toBeVisible();
  await expect(h1(page)).not.toBeEmpty();
  return true;
}

async function expectDetailForm(page) {
  await expect(page.locator('.basic-card input').first()).toBeVisible();
  // The header's ActionBar: the rows of a tax class carry Delete buttons of their own.
  const actions = page.getByRole('group', { name: either((t) => t.common.actions) });
  await expect(actions.getByRole('button', { name: either((t) => t.pm.save) })).toBeVisible();
  await expect(actions.getByRole('button', { name: either((t) => t.common.delete) })).toBeVisible();
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 PriceManager (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('prices list: channel menu, first price and its promo date picker', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/pricing/prices');

      await expect(h1(page)).toHaveText(either((t) => t.pm.prices));
      await expect(page.getByRole('group', { name: either((t) => t.pm.price_filter) })).toBeVisible();
      // Channels and rows load after the page settles: wait for the rows or the empty state before a check may skip.
      const skuLinks = page.locator('.pm-price-table__row a');
      const empty = page.locator('.empty-state').or(page.getByText(either((t) => t.pm.no_prices)));
      await expect(skuLinks.first().or(empty.first())).toBeVisible({ timeout: 10000 });
      const channel = page.locator('.page-header').getByRole('combobox');
      if (await channel.count()) {
        await channel.click();
        await expect(page.getByRole('option').first()).toBeVisible();
        await page.keyboard.press('Escape');
      }

      // The last row's promo calendar shows whole: the table's scroll box must not cut it off, and the table carries
      // one calendar (the open one), not one per cell.
      // Both of the last row's pickers: From, and To at the table's right edge.
      const triggers = page.locator('.pm-price-table__row .basic-date-picker__trigger');
      for (const trigger of (await triggers.count()) ? [triggers.nth(-2), triggers.nth(-1)] : []) {
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();
        const calendar = page.locator('.pm-price-table .flatpickr-calendar');
        await expect(calendar).toHaveCount(1);
        await expect(calendar).toBeInViewport({ ratio: 1 });
        // The box scrolls sideways only; a vertical scroll inside it means the calendar grew it.
        const hiddenBelow = await page
          .locator('.pm-price-table')
          .evaluate((box) => box.scrollHeight - box.clientHeight);
        expect(hiddenBelow).toBeLessThanOrEqual(1);
        await trigger.click();
        await expect(calendar).toHaveCount(0);
      }

      if (await openFirst(page, skuLinks, empty, /\/pricing\/prices\/[^/]+$/)) {
        await expect(page.getByRole('button', { name: either((t) => t.pm.save) })).toBeVisible();
        const from = page.locator('.basic-date-picker__trigger').first();
        await from.click();
        await expect(page.locator('.basic-date-picker .flatpickr-calendar').first()).toBeVisible();
        await from.click();
      }

      collector.assertNoErrors(expect, 'Prices');
    });

    test('tax classes list opens the first tax class', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/pricing/tax-classes');

      await expect(h1(page)).toHaveText(either((t) => t.pm.tax_classes));
      const rows = page.locator('.data-table__row');
      if (await openFirst(page, rows, page.locator('.empty-state'), /\/pricing\/tax-classes\/(?!create$)[^/]+$/)) {
        await expectDetailForm(page);
      }

      collector.assertNoErrors(expect, 'Tax classes');
    });

    test('channels list opens the first channel', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/pricing/channels');

      await expect(h1(page)).toHaveText(either((t) => t.pm.channels));
      await expect(page.getByRole('button', { name: either((t) => t.pm.sync_channels) })).toBeVisible();
      const rows = page.locator('.data-table__row');
      if (await openFirst(page, rows, page.locator('.empty-state'), /\/pricing\/channels\/(?!create$)[^/]+$/)) {
        await expectDetailForm(page);
      }

      collector.assertNoErrors(expect, 'Channels');
    });
  });
}
