const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 Leads companies smoke (plan 53): companies → the first company card and its tabs, add lead, board, import,
 * stages and lead types — desktop only (board and import are desktop screens). Read-only: opens lists, the card, a
 * select and the do-not-contact confirmation, never saves, moves, uploads, confirms or deletes.
 */

test.use({ viewport: { width: 1280, height: 720 } });

// The admin profile picks the UI language; accept either locale's text.
const { either: escapedEither } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));
const h1 = (page) => page.getByRole('heading', { level: 1 });

async function openPage(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

test.describe('P5 Leads companies (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('companies list opens the first company card with its tabs and header selects', async ({ page }) => {
    const collector = createErrorCollector(page);
    await openPage(page, '/leads/companies');

    await expect(page.getByTestId('companies-add')).toBeVisible();
    await expect(page.getByTestId('companies-item').or(page.getByTestId('companies-empty')).first()).toBeVisible();
    if (await page.getByTestId('companies-item').count()) {
      await page.getByTestId('companies-item').first().click();
      await page.waitForURL(/\/leads\/companies\/\d+/);
      await expect(page.getByTestId('company-card')).toBeVisible();
      await expect(h1(page)).toHaveText(either((t) => t.leads.company.title));
      await expect(page.getByTestId('thread-company')).not.toBeEmpty();
      await expect(page.getByTestId('company-communicate')).toBeVisible();

      const stage = page.getByRole('combobox', { name: either((t) => t.leads.company.stage) });
      await expect(stage).toBeVisible();
      await expect(page.getByRole('combobox', { name: either((t) => t.leads.company.type) })).toBeVisible();
      await stage.click();
      await expect(page.getByRole('option').first()).toBeVisible();
      await page.keyboard.press('Escape');

      for (const [tab, panel] of [['intel', 'company-intel'], ['contacts', 'contacts-tab'], ['overview', 'company-overview']]) {
        await page.getByTestId(`company-tab-${tab}`).click();
        await expect(page.getByTestId(`company-tab-${tab}`)).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByTestId(panel)).toBeVisible();
      }

      // The do-not-contact confirmation opens and closes without a request.
      if (await page.getByTestId('company-dnc').count()) {
        await page.getByTestId('company-dnc').click();
        await expect(page.getByTestId('confirm-dialog-cancel')).toBeVisible();
        await page.getByTestId('confirm-dialog-cancel').click();
        await expect(page.getByTestId('confirm-dialog-cancel')).toHaveCount(0);
      }
    }

    collector.assertNoErrors(expect, 'Companies');
  });

  test('add lead: the page title and a Save that waits for a domain', async ({ page }) => {
    const collector = createErrorCollector(page);
    await openPage(page, '/leads/companies/new');

    await expect(h1(page)).toHaveText(either((t) => t.leads.add.title));
    await expect(page.getByTestId('add-lead-save')).toBeDisabled();
    await expect(page.getByTestId('add-lead-domain').locator('input')).toBeVisible();

    collector.assertNoErrors(expect, 'Add lead');
  });

  test('board: title, search, chips and the stage columns', async ({ page }) => {
    const collector = createErrorCollector(page);
    await openPage(page, '/leads/board');

    await expect(h1(page)).toHaveText(either((t) => t.leads.board.title));
    await expect(page.getByTestId('board-column').first()).toBeVisible();
    await expect(page.getByRole('searchbox', { name: either((t) => t.leads.board.search) })).toBeVisible();
    await expect(page.getByRole('group', { name: either((t) => t.leads.board.filters) })).toBeVisible();

    collector.assertNoErrors(expect, 'Board');
  });

  test('import: title, sections and an Upload that waits for a file', async ({ page }) => {
    const collector = createErrorCollector(page);
    await openPage(page, '/leads/import');

    await expect(h1(page)).toHaveText(either((t) => t.leads.import.title));
    await expect(page.getByTestId('import-columns')).toBeVisible();
    await expect(page.getByTestId('import-upload')).toBeDisabled();
    await expect(page.getByTestId('import-sample')).toBeVisible();

    collector.assertNoErrors(expect, 'Import');
  });

  test('stages and lead types: title, rows and the way back to Settings', async ({ page }) => {
    const collector = createErrorCollector(page);
    await openPage(page, '/leads/settings/stages');

    await expect(h1(page)).toHaveText(either((t) => t.leads.stages.title));
    await expect(page.getByTestId('stage-row').first()).toBeVisible();
    await expect(page.getByRole('button', { name: either((t) => t.common.back) }).first()).toBeVisible();

    await openPage(page, '/leads/settings/lead-types');
    await expect(h1(page)).toHaveText(either((t) => t.leads.lead_types.title));
    await expect(page.getByTestId('lead-type-row').first()).toBeVisible();
    await expect(page.getByTestId('lead-type-save')).toBeVisible();

    collector.assertNoErrors(expect, 'Stages and lead types');
  });
});
