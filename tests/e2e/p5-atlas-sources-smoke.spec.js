const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 Atlas sources smoke (plan 47): the source list (delete dialog opened and cancelled) and the first source's
 * detail: H1, back arrow, Save in the header ActionBar, every tab selected in turn. Read-only: never saves, triggers,
 * pushes, confirms or deletes.
 */

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  phone: { width: 390, height: 844 },
};

// The admin profile picks the UI language; accept either locale's text.
const { either: escapedEither } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));
const h1 = (page) => page.getByRole('heading', { level: 1 });
const TABS = ['overview', 'feeds', 'mappings', 'products', 'linked', 'logs'];

async function openList(page) {
  await page.goto('/atlas/list');
  await page.waitForLoadState('networkidle');
  await expect(h1(page)).toHaveText(either((t) => t.atlas.list_title));
  await expect(page.getByTestId('suppliers-create-btn')).toBeVisible();
  const rows = page.locator('.data-table__row');
  await expect(rows.first().or(page.locator('.empty-state').first())).toBeVisible({ timeout: 10000 });
  return rows;
}

async function openAndCancelDelete(page) {
  await page.locator('[data-testid^="suppliers-delete-"]').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('radiogroup')).toBeVisible();
  await expect(dialog.getByTestId('suppliers-delete-soft-radio')).toBeChecked();
  await dialog.getByTestId('suppliers-delete-cancel').click();
  await expect(dialog).toHaveCount(0);
}

async function walkTabs(page) {
  const tabs = page.getByRole('tablist');
  await expect(tabs).toBeVisible();
  for (const key of TABS) {
    const tab = page.getByTestId(`suppliers-tab-${key}`);
    if (!(await tab.count())) continue; // mappings is hidden for a monitoring source
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toBeVisible();
  }
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 Atlas sources (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('list, delete dialog, first source and its tabs', async ({ page }) => {
      const collector = createErrorCollector(page);
      const rows = await openList(page);
      test.skip(!(await rows.count()), 'no source on this stack');

      await openAndCancelDelete(page);
      await rows.first().click();
      await page.waitForURL(/\/atlas\/(?!list$)[^/]+$/);
      await page.waitForLoadState('networkidle');

      await expect(h1(page)).not.toBeEmpty();
      await expect(page.getByRole('main').getByRole('button', { name: either((t) => t.common.back) })).toBeVisible();
      const actions = page.getByRole('group', { name: either((t) => t.common.actions) });
      await expect(actions.getByTestId('suppliers-overview-save')).toBeDisabled();

      await walkTabs(page);
      collector.assertNoErrors(expect, 'Atlas sources');
    });
  });
}
