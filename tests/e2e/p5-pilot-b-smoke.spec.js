const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 pilot B smoke (plan 32): logged out, the login wall and the password-reset page; logged in, the enrichment
 * runs list, the spawn-rule list and its first rule, Docs.
 * Read-only: renders and opens, never submits, saves, runs, confirms or deletes.
 */

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  phone: { width: 390, height: 844 },
};

// The admin profile (or, logged out, the build default) picks the UI language; accept either locale's text.
const { either: escapedEither } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));

async function openPage(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

async function expectListOrEmpty(page) {
  await expect(page.locator('.data-table__row, .empty-state').first()).toBeVisible({ timeout: 10000 });
}

async function expectPasswordField(page, label) {
  const field = page.getByLabel(either(label));
  await expect(field).toHaveAttribute('type', 'password');
  await expect(page.getByRole('button', { name: either((t) => t.login.show_password) }).first()).toBeVisible();
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 pilot B logged out (${name})`, () => {
    test.use({ viewport });

    test('login wall renders its labelled form', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/');

      await expect(page.getByText(either((t) => t.login.welcome))).toBeVisible();
      await expect(page.getByLabel(either((t) => t.login.username))).toBeVisible();
      await expectPasswordField(page, (t) => t.login.password);
      await expect(page.getByRole('button', { name: either((t) => t.login.submit), exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: either((t) => t.login.forgot_password) })).toBeVisible();

      collector.assertNoErrors(expect, 'Login wall');
    });

    test('password reset page renders its form', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/password-reset?key=smoke');

      await expect(page.getByText(either((t) => t.reset.title))).toBeVisible();
      await expectPasswordField(page, (t) => t.reset.new_password);
      await expect(page.getByRole('button', { name: either((t) => t.reset.submit) })).toBeVisible();

      collector.assertNoErrors(expect, 'Password reset');
    });
  });

  test.describe(`P5 pilot B logged in (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('enrichment runs list renders', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/enrichment/runs');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.enrichment.review.title));
      await expectListOrEmpty(page);

      collector.assertNoErrors(expect, 'Enrichment runs');
    });

    test('spawn-rule list opens the first rule', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/enrichment/settings/spawn-rules');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.nav.enrichment_settings));
      await expectListOrEmpty(page);

      // The first cell, not the row's middle: the row ends in a "Run now" button.
      const firstCell = page.locator('.data-table__row .data-table__cell').first();
      if (await firstCell.count()) {
        await firstCell.click();
        await page.waitForURL(/\/enrichment\/settings\/spawn-rules\/[^/]+$/);
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
        await expect(page.locator('[data-test="spawn-rule-save-btn"]')).toBeVisible();
      } else {
        test.info().annotations.push({ type: 'skipped', description: 'no spawn rule on this stack: detail not opened' });
      }

      collector.assertNoErrors(expect, 'Spawn rules');
    });

    test('docs render', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/pages/doc');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.nav.docs));
      await expect(page.locator('.markdown-renderer-wrapper > div')).toHaveText(/\S/);

      collector.assertNoErrors(expect, 'Docs');
    });
  });
}
