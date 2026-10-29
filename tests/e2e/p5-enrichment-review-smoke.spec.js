const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 EnrichmentReview smoke (plan 45): list mode, the switch to focus mode, the drift dialog opened and closed, the
 * CSV import dialog opened and cancelled. Read-only: never accepts, rejects, imports or confirms. The stack seeds no
 * drifted proposal, so the drift test serves the first listed proposal as `drifted` (a response rewrite, no write).
 */

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  phone: { width: 390, height: 844 },
};

const PROPOSALS = '**/api/enrichment/v2/admin/proposals/?*';

// The admin profile picks the UI language; accept either locale's text.
const { either: escapedEither } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));
const h1 = (page) => page.getByRole('heading', { level: 1 });

async function openReview(page) {
  await page.goto('/enrichment');
  await page.waitForLoadState('networkidle');
  await expect(h1(page)).toHaveText(either((t) => t.enrichment.review.title));
  await expect(page.locator('.data-table__row').first().or(page.locator('.empty-state').first())).toBeVisible({
    timeout: 10000,
  });
}

async function expectClosesOnCancel(page, dialog) {
  await dialog.getByRole('button', { name: either((t) => t.common.cancel) }).click();
  await expect(dialog).toHaveCount(0);
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 EnrichmentReview (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('list mode: the bulk primary or the empty state, the import dialog opens and cancels', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openReview(page);

      const bulkAccept = page.getByTestId('enrichment-bulk-accept');
      await expect(bulkAccept.or(page.locator('.empty-state').first())).toBeVisible();

      await page.getByTestId('enrichment-import-open').click();
      const dialog = page.getByRole('dialog', { name: either((t) => t.enrichment.import.title) });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId('enrichment-import-submit')).toBeDisabled();
      await expectClosesOnCancel(page, dialog);

      collector.assertNoErrors(expect, 'Enrichment review list');
    });

    test('focus mode: Accept is the one primary, Reject and Skip beside it', async ({ page }) => {
      const collector = createErrorCollector(page);
      await openReview(page);

      await page.getByTestId('enrichment-mode-focus').click();
      await expect(page).toHaveURL(/mode=focus/);
      const accept = page.getByTestId('enrichment-focus-accept');
      await expect(accept.or(page.locator('.empty-state').first())).toBeVisible();
      if (await accept.count()) {
        await expect(page.getByTestId('enrichment-focus-reject')).toBeVisible();
        await expect(page.getByTestId('enrichment-focus-skip')).toBeVisible();
        await expect(page.locator('.focus-mode .button-basic--primary')).toHaveCount(1);
      }

      await page.getByTestId('enrichment-mode-list').click();
      await expect(page).toHaveURL(/mode=list/);

      collector.assertNoErrors(expect, 'Enrichment review focus');
    });

    test('drift dialog: re-confirm opens it, Cancel closes it', async ({ page }) => {
      const collector = createErrorCollector(page);
      await page.route(PROPOSALS, async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        if (body.results?.length) body.results[0].status = 'drifted';
        await route.fulfill({ response, json: body });
      });
      await openReview(page);

      const reconfirm = page.locator('[data-testid^="enrichment-reconfirm-"]').first();
      // Reported as skipped, never as passed, when there is nothing to open.
      test.skip(!(await reconfirm.count()), 'no proposal on this stack: drift dialog not opened');
      await reconfirm.click();
      const dialog = page.getByRole('dialog', { name: either((t) => t.enrichment.drift.title) });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId('enrichment-drift-confirm')).toHaveText(either((t) => t.enrichment.drift.confirm));
      await expect(dialog.getByTestId('enrichment-drift-reject')).toBeVisible();
      await expectClosesOnCancel(page, dialog);

      collector.assertNoErrors(expect, 'Enrichment drift dialog');
    });
  });
}
