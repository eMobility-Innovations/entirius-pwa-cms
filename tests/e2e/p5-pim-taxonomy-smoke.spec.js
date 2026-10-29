const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 Pim taxonomy smoke (plan 51): categories, features, feature sets and quality rules on the page frame — each list
 * with the channel selector in its header and no wrapper bar, the first record and the create forms with Save in the
 * header. Read-only: never saves, confirms or deletes (a menu is opened and closed with Escape).
 */

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  phone: { width: 390, height: 844 },
};

// The admin profile picks the UI language; accept either locale's text.
const { either: escapedEither, escapeRegExp } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));
// A message with a `{name}` placeholder, in either locale, for any name.
const eitherWithName = (pick) =>
  new RegExp(`^(${[en, pl].map((t) => pick(t).split('{name}').map(escapeRegExp).join('.+')).join('|')})$`);
const h1 = (page) => page.getByRole('heading', { level: 1 });
const saveButton = (page, pick = (t) => t.common.save) => page.getByRole('button', { name: either(pick) });

async function openPage(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

async function expectHeader(page) {
  await expect(h1(page)).not.toBeEmpty();
  await expect(page.getByTestId('pim-channel-select')).toBeVisible();
  await expect(page.locator('.panel-toolbar')).toHaveCount(0);
}

// A list screen: its H1, then the first data row (or the empty state). Returns the data rows.
async function openList(page, path, title) {
  await openPage(page, path);
  await expect(h1(page)).toHaveText(either(title));
  await expectHeader(page);
  const rows = page.getByRole('row').filter({ has: page.getByRole('gridcell') });
  await expect(rows.first().or(page.locator('.empty-state').first())).toBeVisible({ timeout: 10000 });
  return rows;
}

// The seeded stack carries rows in every list this smoke opens: a missing first row is a failure, not a skip.
async function openFirstRow(page, rows, url) {
  await expect(rows.first()).toBeVisible();
  await rows.first().click();
  await page.waitForURL(url);
  await page.waitForLoadState('networkidle');
  await expectHeader(page);
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 Pim taxonomy (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('categories: the create form, the tree expands by its button, the first category', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/pim/categories/create');
      await expect(h1(page)).toHaveText(either((t) => t.pim.create_category));
      await expectHeader(page);
      await expect(saveButton(page)).toBeVisible();

      await openPage(page, '/pim/categories');
      await expect(h1(page)).toHaveText(either((t) => t.pim.category_tree));
      await expectHeader(page);
      // The toggle clicked is the one that reports expanded (its name changes with the state, the element stays).
      const toggle = await page.locator('.tree-node__row').getByRole('button', { expanded: false }).first().elementHandle();
      await toggle.click();
      await expect.poll(() => toggle.getAttribute('aria-expanded')).toBe('true');
      // Last: the category's products tab loads its own chunks, so nothing navigates away while they arrive.
      const edit = page.locator('.tree-node__row').getByRole('button', { name: either((t) => t.common.edit) });
      await edit.first().click();
      await page.waitForURL(/\/pim\/categories\/.+/);
      await page.waitForLoadState('networkidle');
      await expectHeader(page);
      await expect(saveButton(page)).toBeVisible();
      await page.getByRole('tab').nth(1).click();
      await expect(page.getByRole('heading', { name: either((t) => t.pim.pinned_products) })).toBeVisible();
      await page.waitForLoadState('networkidle');

      collector.assertNoErrors(expect, 'Pim categories');
    });

    test('features: the list, the first feature and the create form', async ({ page }) => {
      const collector = createErrorCollector(page);
      const rows = await openList(page, '/pim/features', (t) => t.pim.features);
      await openFirstRow(page, rows, /\/pim\/features\/.+/);
      await expect(saveButton(page)).toBeVisible();
      await expect(page.locator('.basic-card .form-grid').first()).toBeVisible();
      // The switches load as async chunks after the form shows; leaving earlier aborts them (a false request failure).
      await expect(page.getByRole('switch').first()).toBeVisible();

      await openPage(page, '/pim/features/create');
      await expect(h1(page)).toHaveText(either((t) => t.pim.create_feature));
      await expectHeader(page);
      await expect(saveButton(page)).toBeVisible();

      collector.assertNoErrors(expect, 'Pim features');
    });

    test('feature sets: the list, the first set with its groups and library', async ({ page }) => {
      const collector = createErrorCollector(page);
      const rows = await openList(page, '/pim/feature-sets', (t) => t.pim.feature_sets);
      await openFirstRow(page, rows, /\/pim\/feature-sets\/.+/);

      await expect(saveButton(page, (t) => t.pim.save_set_config)).toBeVisible();
      await expect(page.getByRole('heading', { name: either((t) => t.pim.default_group) })).toBeVisible();
      const collapse = page.getByRole('button', { expanded: true }).first();
      await expect(collapse).toBeVisible();
      // The seed has no attribute group (checked 2026-09-29): the group menu is checked only on a stack that has one.
      const menu = page.getByRole('button', { name: eitherWithName((t) => t.pim.group_actions) }).first();
      if (await menu.count()) {
        await menu.click();
        await expect(page.getByRole('menuitem', { name: either((t) => t.pim.rename) })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('menu')).toBeHidden();
      } else {
        test.info().annotations.push({ type: 'note', description: 'no attribute group on the stack: group menu not checked' });
      }

      collector.assertNoErrors(expect, 'Pim feature sets');
    });

    test('quality rules: the create form, the list with its settings, the first rule', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/pim/gap-definitions/create');
      test.skip(page.url().includes('/pim/products'), 'the quality API is off on this stack');
      await expect(h1(page)).toHaveText(either((t) => t.pim.create_gap_definition));
      await expectHeader(page);
      await expect(page.getByTestId('gap-save-btn')).toBeVisible();

      // Last: the rule form loads its own chunks, so nothing navigates away while they arrive.
      const rows = await openList(page, '/pim/gap-definitions', (t) => t.pim.gap_definitions);
      await openFirstRow(page, rows, /\/pim\/gap-definitions\/.+/);
      await expect(page.getByTestId('gap-save-btn')).toBeVisible();
      await expect(h1(page)).not.toHaveText(either((t) => t.pim.gap_definition_detail));
      await page.waitForLoadState('networkidle');

      collector.assertNoErrors(expect, 'Pim quality rules');
    });
  });
}
