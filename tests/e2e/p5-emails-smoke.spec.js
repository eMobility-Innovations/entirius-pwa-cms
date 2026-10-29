const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 Emails smoke (plan 34): dashboard → channel → language config, dashboard → template type → first template.
 * Read-only: opens lists and details, never saves, sends, confirms or deletes.
 */

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  phone: { width: 390, height: 844 },
};

// The admin profile picks the UI language; accept either locale's text.
const { either: escapedEither } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));

async function openDashboard(page) {
  await page.goto('/emails');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.emails.dashboard));
}

// A card opens by keyboard: its title link is the tab stop.
async function openFirstCard(page, testid, url) {
  const card = page.getByTestId(testid).first();
  await expect(card).toBeVisible({ timeout: 10000 });
  await card.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(url);
  await page.waitForLoadState('networkidle');
}

async function expectDetail(page) {
  await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
  await expect(page.getByTestId('emails-save')).toHaveText(either((t) => t.common.save));
  await expect(page.locator('.basic-card .form-grid').first()).toBeVisible();
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 Emails (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('dashboard opens a channel and its first language config', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openDashboard(page);

      await openFirstCard(page, 'emails-channel-card', /\/emails\/channels\/[^/]+$/);
      await expectDetail(page);

      await openFirstCard(page, 'emails-lang-config-card', /\/emails\/lang-configs\/[^/]+$/);
      await expectDetail(page);

      collector.assertNoErrors(expect, 'Emails channel');
    });

    test('dashboard opens a template type and its first template', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openDashboard(page);

      await openFirstCard(page, 'emails-type-card', /\/emails\/templates\/[^/]+$/);
      await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();

      await openFirstCard(page, 'emails-template-card', /\/emails\/templates\/[^/]+\/[^/]+$/);
      await expectDetail(page);

      collector.assertNoErrors(expect, 'Emails templates');
    });
  });
}
