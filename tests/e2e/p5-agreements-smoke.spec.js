const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 Agreements smoke (plan 36): the definitions list and its first agreement, the consents list and its first
 * person (the legal text dialog opens and closes).
 * Read-only: opens lists, details and the dialog, never saves, sends, confirms or deletes. A seed has no legal consent
 * with a content route, so the person's history gets one stubbed record and the dialog its stubbed text.
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

async function openFirstRow(page, url) {
  await expect(page.locator('.data-table__row, .empty-state').first()).toBeVisible({ timeout: 10000 });
  const firstRow = page.locator('.data-table__row').first();
  if (!(await firstRow.count())) return false;
  await firstRow.click();
  await page.waitForURL(url);
  await page.waitForLoadState('networkidle');
  return true;
}

async function expectNoSidewaysScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const LEGAL_RECORD = {
  id: 990001,
  agreement_slug: 'smoke-terms',
  agreement_name: 'Smoke terms',
  version_number: 1,
  granted: true,
  source: 'checkout',
  channel_idx: 'default-europe',
  created_at: '2026-01-01T10:00:00Z',
  category: 'mandatory',
  has_content_route: true,
};

async function stubLegalRecord(page) {
  await page.route(/\/agreements\/v2\/admin\/people\/[^/]+\/$/, async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    await route.fulfill({ response, json: { ...json, history: [...(json.history || []), LEGAL_RECORD] } });
  });
  await page.route(new RegExp(`/consent-text/${LEGAL_RECORD.id}/$`), (route) =>
    route.fulfill({ json: { agreement_name: 'Smoke terms', version_number: 1, text_html: '<p>Smoke legal text</p>' } }));
}

async function checkLegalTextDialog(page) {
  await page.getByRole('tab', { name: either((t) => t.agm.tab_legal) }).click();
  await page.getByRole('button', { name: either((t) => t.agm.view_legal_text) }).first().click();
  const dialog = page.getByRole('dialog', { name: either((t) => t.agm.legal_text_at_consent) });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Smoke legal text')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: either((t) => t.agm.view_legal_text) }).first().click();
  await dialog.getByTestId('basic-modal-close').click();
  await expect(dialog).toBeHidden();
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 Agreements (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('definitions list opens the first agreement', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openPage(page, '/agreements/list');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.agm.definitions));
      await expect(page.getByRole('group', { name: either((t) => t.agm.category) })).toBeVisible();
      await expect(page.locator('[data-fid="fab"]')).toBeVisible();

      if (await openFirstRow(page, /\/agreements\/(?!list$)[^/]+$/)) {
        await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
        await expect(page.getByRole('button', { name: either((t) => t.agm.save) })).toBeVisible();
        await expect(page.locator('.basic-card .form-grid').first()).toBeVisible();
        await expect(page.getByRole('heading', { level: 2, name: either((t) => t.agm.versions) })).toBeVisible();
        await expectNoSidewaysScroll(page);

        if (name === 'phone') {
          const versionsCard = page.locator('.basic-card').filter({
            has: page.getByRole('heading', { level: 2, name: either((t) => t.agm.versions) }),
          });
          const versionRowCount = await versionsCard.locator('.data-table__row').count();
          if (versionRowCount > 0) {
            await expect(versionsCard.locator('.data-table__row').first()).toBeVisible();
          } else {
            test.info().annotations.push({
              type: 'skip',
              description: 'Seed has no agreement versions — versions table phone check skipped',
            });
          }
        }
      }

      collector.assertNoErrors(expect, 'Agreements definitions');
    });

    test('consents list opens the first person and the legal text dialog', async ({ page }) => {
      const collector = createErrorCollector(page);
      await stubLegalRecord(page);
      await openPage(page, '/agreements/consents');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(either((t) => t.agm.people_list));
      await expect(page.getByRole('tabpanel')).toBeVisible();

      if (await openFirstRow(page, /\/agreements\/consents\/[^/]+$/)) {
        await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
        await expect(page.getByRole('tabpanel')).toBeVisible();
        await checkLegalTextDialog(page);
      }

      collector.assertNoErrors(expect, 'Agreements consents');
    });
  });
}
