const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 Leads inbox smoke (plan 54): the Inbox → its first conversation → the thread, and the Review screen with its
 * action bar (on a desktop and at 390 px, where the bar stays pinned in view). Read-only: opens lists, a draft, the
 * more menu and the rewrite dialog; never sends, skips, rewrites, edits or confirms. A stack without conversations
 * checks the empty state and annotates the run; without a draft the Review tests are skipped with the reason in the
 * report, never passed silently (drafts exist after `make bdd TAGS=@funnel`, the W5 close runs them there).
 */

const { either: escapedEither } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));
const h1 = (page) => page.getByRole('heading', { level: 1 });

async function openInbox(page, filter) {
  await page.goto('/leads/inbox');
  await expect(page.getByTestId('inbox-summary').or(page.getByTestId('inbox-empty')).first()).toBeVisible();
  await page.getByTestId(`inbox-filter-${filter}`).click();
  await page.waitForLoadState('networkidle');
}

// The draft's screen: title, the draft, the pinned action bar with Send enabled — never pressed.
async function checkReview(page) {
  await expect(h1(page)).toHaveText(either((t) => t.leads.review.title));
  await expect(page.getByTestId('review-subject')).toBeVisible();
  const bar = page.getByTestId('review-actions');
  await expect(bar).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('review-send')).toBeEnabled();
  await expect(page.getByTestId('review-skip')).toBeVisible();
  await page.getByTestId('review-more').click();
  await expect(page.getByTestId('review-edit')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('review-edit')).toHaveCount(0);
}

async function openFirstDraft(page) {
  await openInbox(page, 'draft');
  if (!(await page.getByTestId('inbox-item').count())) {
    await expect(page.getByTestId('inbox-empty')).toBeVisible();
    test.skip(true, 'no draft on the stack — runs at the W5 close after `bdd @funnel`');
  }
  await page.getByTestId('inbox-item').first().getByRole('link').click();
  await page.waitForURL(/\/leads\/inbox\/\d+/);
}

test.describe('P5 Leads inbox (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('inbox → the first conversation → its thread', async ({ page }) => {
    const collector = createErrorCollector(page);
    await openInbox(page, 'all');
    await expect(page.getByTestId('inbox-filter-all')).toBeVisible();

    const rows = page.getByTestId('inbox-item');
    if (!(await rows.count())) {
      test.info().annotations.push({ type: 'data', description: 'the stack has no conversation: the thread is not opened' });
      await expect(page.getByTestId('inbox-empty')).toBeVisible();
    } else {
      await rows.first().getByRole('link').click();
      await page.waitForURL(/\/leads\/(inbox|conversations|companies)\/\d+/);
      if (/\/leads\/inbox\//.test(page.url())) {
        await checkReview(page);
      } else {
        if (/\/leads\/companies\//.test(page.url())) await page.getByTestId('company-tab-timeline').click();
        await expect(page.getByTestId('thread-timeline').first()).toBeVisible();
        await expect(h1(page)).toBeVisible();
      }
    }

    collector.assertNoErrors(expect, 'Leads inbox');
  });

  test('review: title, draft and the action bar; the rewrite dialog opens and closes', async ({ page }) => {
    const collector = createErrorCollector(page);
    await openFirstDraft(page);
    await checkReview(page);
    await page.getByTestId('review-more').click();
    const rewrite = page.getByTestId('review-rewrite');
    if (await rewrite.isEnabled()) {
      await rewrite.click();
      await expect(page.getByTestId('rewrite-modal')).toBeVisible();
      await expect(page.getByTestId('rewrite-submit')).toBeDisabled();
      await page.getByTestId('rewrite-cancel').click();
      await expect(page.getByTestId('rewrite-modal')).toHaveCount(0);
      await expect(page.getByTestId('review-more')).toBeFocused();
    } else {
      await page.keyboard.press('Escape');
    }
    collector.assertNoErrors(expect, 'Leads review');
  });
});

test.describe('P5 Leads inbox (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('review keeps its action bar pinned in view on a phone', async ({ page }) => {
    const collector = createErrorCollector(page);
    await openFirstDraft(page);
    await checkReview(page);
    await expect(page.getByRole('button', { name: either((t) => t.common.back) }).first()).toBeVisible();
    collector.assertNoErrors(expect, 'Leads review (phone)');
  });
});
