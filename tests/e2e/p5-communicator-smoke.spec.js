const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 Communicator smoke (plan 55): Leads → Settings, the template list → the first template (versions and test
 * generate drawers), sequences with the text pool, and the sending settings (policy, channel, footer, waiting
 * mails, suppressions). Read-only: opens lists, drawers, a select and the remove confirmation, never saves, sends,
 * generates, confirms or deletes. 1280 × 800 with the sidebar open — the viewport Send now must fit (C-31).
 */

test.use({ viewport: { width: 1280, height: 800 } });

// Chromium's note on the footer preview is not a page error: it logs a blocked script for every sandboxed srcdoc
// frame, even an empty one.
const SRCDOC_NOTE = ["Blocked script execution in 'about:srcdoc'"];

// C-31 needs a waiting mail with long cells; a read-only smoke never creates one, so the outbox answer is stubbed.
const WAITING = {
  id: 900001,
  status: 'scheduled',
  subject: 'Re: A deliberately long follow-up subject that would push the table wider than the content column',
  scheduled_at: '2099-01-02T08:00:00Z',
  next_slot: '2099-01-02T08:00:00Z',
  thread: { recipient_email: 'a.very.long.recipient.address@an-example-shop-with-a-long-domain.test' },
  render_context: { company_name: 'An Example Shop With A Very Long Company Name Sp. z o.o.' },
};

async function stubWaitingMails(page) {
  await page.route(/\/api\/communicator\/v2\/admin\/[^/]+\/messages\/\?/, (route) => {
    const scheduled = new URL(route.request().url()).searchParams.get('status') === 'scheduled';
    return route.fulfill({ json: { count: scheduled ? 1 : 0, results: scheduled ? [WAITING] : [] } });
  });
}

// The admin profile picks the UI language; accept either locale's text.
const { either: escapedEither } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));
const h1 = (page) => page.getByRole('heading', { level: 1 });

async function openPage(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

test.describe('P5 Communicator settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('settings hub lists the sections and opens the templates', async ({ page }) => {
    const collector = createErrorCollector(page, { whitelist: SRCDOC_NOTE });
    await openPage(page, '/leads/settings');

    await expect(h1(page)).toHaveText(either((t) => t.nav.leads_settings));
    for (const section of ['stages', 'lead-types', 'templates', 'sequences', 'sending']) {
      await expect(page.getByTestId(`settings-${section}`)).toBeVisible();
    }
    await page.getByTestId('settings-templates').click();
    await page.waitForURL(/\/leads\/settings\/templates$/);
    await expect(h1(page)).toHaveText(either((t) => t.communicator.templates.title));

    collector.assertNoErrors(expect, 'Settings hub');
  });

  test('template list opens the first template with its drawers', async ({ page }) => {
    const collector = createErrorCollector(page, { whitelist: SRCDOC_NOTE });
    await openPage(page, '/leads/settings/templates');

    await expect(page.getByRole('button', { name: either((t) => t.common.back) }).first()).toBeVisible();
    const rows = page.getByTestId('template-row');
    await expect(rows.first()).toBeVisible();
    await rows.first().click();
    await page.waitForURL(/\/leads\/settings\/templates\/\d+/);

    await expect(h1(page)).not.toBeEmpty();
    await expect(page.getByTestId('template-save')).toBeVisible();
    await expect(page.getByTestId('template-body').locator('textarea')).toBeVisible();
    const kind = page.getByRole('combobox', { name: either((t) => t.communicator.template.kind) });
    await kind.click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('template-versions').click();
    await expect(page.getByTestId('template-versions-list')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('template-versions-list')).toHaveCount(0);
    await page.getByTestId('template-test-generate').click();
    await expect(page.getByTestId('test-generate-search').locator('input')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('test-generate')).toHaveCount(0);

    collector.assertNoErrors(expect, 'Template edit');
  });

  test('sequences: steps, the text pool and a remove that asks first', async ({ page }) => {
    const collector = createErrorCollector(page, { whitelist: SRCDOC_NOTE });
    await openPage(page, '/leads/settings/sequences');

    await expect(h1(page)).toHaveText(either((t) => t.communicator.sequences.title));
    await expect(page.getByTestId('sequence-add')).toBeVisible();
    // The seed carries the follow-up sequence and its text pool.
    await expect(page.getByTestId('sequence').first()).toBeVisible();
    await expect(page.getByTestId('text-pool').first()).toBeVisible();
    // An active text has its edit and remove squares (C-33); remove asks first and is cancelled here.
    await expect(page.getByTestId('pool-text-edit').first()).toBeVisible();
    const remove = page.getByTestId('pool-text-remove').first();
    await expect(remove).toBeVisible();
    await remove.click();
    await expect(page.getByTestId('confirm-dialog-cancel')).toBeVisible();
    await page.getByTestId('confirm-dialog-cancel').click();
    await expect(page.getByTestId('confirm-dialog-cancel')).toHaveCount(0);

    collector.assertNoErrors(expect, 'Sequences');
  });

  test('sending settings: every section, and Send now stays on screen (C-31)', async ({ page }) => {
    const collector = createErrorCollector(page, { whitelist: SRCDOC_NOTE });
    await stubWaitingMails(page);
    await openPage(page, '/leads/settings/sending');

    await expect(h1(page)).toHaveText(either((t) => t.communicator.settings.title));
    for (const section of ['policy', 'channel', 'footer', 'scheduled', 'suppressions']) {
      await expect(page.getByTestId(`settings-${section}`)).toBeVisible();
    }
    await expect(page.getByTestId('policy-save')).toBeVisible();
    await expect(page.getByTestId('footer-preview')).toBeVisible();

    // The sidebar is open (300 px) and the row's Send now ends inside the viewport, unscrolled.
    const sidebar = await page.getByTestId('app-sidebar').boundingBox();
    expect(sidebar.width).toBeGreaterThanOrEqual(200);
    const box = await page.locator(`[data-testid="scheduled-row"][data-message="${WAITING.id}"]`).getByTestId('scheduled-send-now').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width);
    expect(box.x + box.width).toBeLessThanOrEqual(1280);

    collector.assertNoErrors(expect, 'Sending settings');
  });
});
