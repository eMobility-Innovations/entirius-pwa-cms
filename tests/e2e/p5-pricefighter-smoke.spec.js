const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const { either: escapedEither } = require('./helpers/text');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 PriceFighter smoke (plan 41): gap table with its first row expanded, strategies with the rule modal opened and
 * closed, decision history. Read-only: never selects rows for apply, saves, confirms or deletes.
 */

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  phone: { width: 390, height: 844 },
};

// The admin profile picks the UI language; accept either locale's text.
const either = (pick) => escapedEither(pick(en), pick(pl));
const h1 = (page) => page.getByRole('heading', { level: 1 });

async function openPage(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

// The rows of the page's list, or its empty state; resolves to the row count.
async function listRows(page) {
  const rows = page.locator('.page-layout .data-table__row');
  await expect(rows.first().or(page.locator('.empty-state').first())).toBeVisible({ timeout: 10000 });
  return rows;
}

// FIX-05: the market cell names the channel on its own line, visibly and whole, not only in a tooltip.
async function expectChannelInMarket(row) {
  const channel = row.locator('[data-column="market"] .market-cell__channel');
  await expect(channel).toBeVisible();
  await expect(channel).toHaveText(/\S/);
  const cut = await channel.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(cut).toBe(false);
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 PriceFighter (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('gap table: filters and the first row expanded', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/pricefighter/gap');

      await expect(h1(page)).toHaveText(either((t) => t.pricefighter.gap_table));
      if (name === 'phone') {
        await expect(page.getByRole('button', { name: either((t) => t.pricefighter.filters) })).toBeVisible();
      } else {
        await expect(page.getByRole('switch', { name: either((t) => t.pricefighter.competitor_only) })).toBeVisible();
      }

      const rows = await listRows(page);
      if (await rows.count()) {
        await expectChannelInMarket(rows.first());
        const toggle = rows.first().locator('.data-table__expand-toggle');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const detail = page.locator('.data-table__expand-row .gap-detail').first();
        await expect(detail.locator('dl')).toBeVisible({ timeout: 10000 });
        await expect(detail.locator('.data-table').or(detail.locator('.t-negative')).first()).toBeVisible();
      }

      collector.assertNoErrors(expect, 'Gap table');
    });

    test('strategies: the rule modal opens and closes', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/pricefighter/strategies');

      await expect(h1(page)).toHaveText(either((t) => t.pricefighter.strategies));
      const create = page.getByRole('button', { name: either((t) => t.pricefighter.new_rule) });
      await expect(create).toBeVisible();
      await create.click();

      const dialog = page.getByRole('dialog', { name: either((t) => t.pricefighter.new_rule) });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: either((t) => t.common.save) })).toBeVisible();
      await dialog.getByRole('button', { name: either((t) => t.common.cancel) }).click();
      await expect(dialog).toHaveCount(0);

      const rows = await listRows(page);
      if (await rows.count()) {
        await rows.first().click();
        const edit = page.getByRole('dialog', { name: either((t) => t.pricefighter.edit_rule) });
        await expect(edit.getByRole('button', { name: either((t) => t.common.delete) })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(edit).toHaveCount(0);
      }

      collector.assertNoErrors(expect, 'Strategies');
    });

    test('history: list and the first entry expanded', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/pricefighter/history');

      await expect(h1(page)).toHaveText(either((t) => t.pricefighter.history));
      const rows = await listRows(page);
      if (await rows.count()) {
        await expectChannelInMarket(rows.first());
        const toggle = rows.first().locator('.data-table__expand-toggle');
        await toggle.click();
        await expect(page.locator('.data-table__expand-row').first()).toBeVisible();
      }

      collector.assertNoErrors(expect, 'History');
    });
  });
}
