const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');
const { either: escapedEither } = require('./helpers/text');

/**
 * Category tree (lazy, level by level): a search switches to a flat result list with the idx of each hit, and
 * "Show in tree" clears the search and highlights the category in its branch. Read-only.
 */
const either = (pick) => escapedEither(pick(en), pick(pl));

test.describe('PIM category tree', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('search lists flat results with the idx; Show in tree reveals the category', async ({ page }) => {
    await page.goto('/pim/categories');
    await page.locator('.tree-node__row').first().waitFor();
    await page.getByPlaceholder(either((t) => t.common.start_typing)).fill('Chairs');

    const results = page.getByTestId('category-results');
    const hit = results.locator('.tree-node').first();
    await expect(hit).toBeVisible();
    const idx = (await hit.locator('.tree-node__idx').textContent()).trim();
    expect(idx).not.toBe('');

    await hit.getByRole('button', { name: either((t) => t.pim.category_show_in_tree) }).click();
    await expect(results).toHaveCount(0);
    await expect(page.locator(`.tree-node[data-idx="${idx}"] .tree-node__row--highlight`)).toBeVisible();
  });
});
