const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 Authors smoke (plan 35): the authors list and its first author; the content editor's author field (a blog post)
 * opens its search menu. Read-only: opens lists, details and menus, never saves, sends, confirms or deletes.
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

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 Authors (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('authors list opens the first author', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/pages/authors');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.authors.title));
      await expect(page.locator('[data-fid="fab"]')).toBeVisible();
      await expect(page.locator('.data-table__row, .empty-state').first()).toBeVisible({ timeout: 10000 });

      const firstRow = page.locator('.data-table__row').first();
      if (await firstRow.count()) {
        await firstRow.click();
        await page.waitForURL(/\/pages\/authors\/[^/]+$/);
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
        await expect(page.getByRole('button', { name: either((t) => t.common.save) })).toBeVisible();
        await expect(page.locator('.basic-card .form-grid').first()).toBeVisible();
        await expect(page.locator('.author-photo-preview')).toBeVisible();
      }

      collector.assertNoErrors(expect, 'Authors');
    });

    test('the content editor author field opens its menu', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/pages/content');

      const blogPost = page.locator('a.data-table__name-link[href*="/blog-post/"]').first();
      test.skip(!(await blogPost.count()), 'no blog post in the stack');
      await blogPost.click();
      await page.waitForURL(/\/blog-post\/[^/]+/);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: either((t) => t.builder.advanced) }).click();
      await page.locator('.builder-author-panel__header').click();
      const field = page.getByRole('combobox', { name: either((t) => t.authors.primary) });
      await field.click();
      await expect(page.getByRole('option').first()).toBeVisible();
      await page.keyboard.press('Escape');

      collector.assertNoErrors(expect, 'Content editor authors');
    });
  });
}
