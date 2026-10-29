const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { createErrorCollector } = require('../helpers/error-collector');
const en = require('../../src/i18n/locales/en.json');
const pl = require('../../src/i18n/locales/pl.json');

/**
 * P5 Atlas review smoke (plan 48): the review queue in its four modes (swipe decision bar, raw data as a side panel
 * or a dialog, the gallery dialog, the list's bulk bar and detail drawer), then Find, Duplicates and Auto-matched.
 * Read-only: never approves, rejects, skips, pushes, acknowledges or merges.
 */

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  phone: { width: 390, height: 844 },
};

// The admin profile picks the UI language; accept either locale's text.
const { either: escapedEither } = require('./helpers/text');
const either = (pick) => escapedEither(pick(en), pick(pl));
const h1 = (page) => page.getByRole('heading', { level: 1 });

async function checkGallery(page) {
  const open = page.getByTestId('product-card-gallery-btn');
  if (!(await open.count())) return;
  await open.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('gallery-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
}

async function checkRawData(page, phone) {
  const name = either((t) => t.atlas.review.raw_data_title);
  if (!phone) {
    await expect(page.getByRole('complementary', { name })).toBeVisible();
    return;
  }
  await page.getByTestId('product-card-raw-data-btn').click();
  const dialog = page.getByRole('dialog', { name });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: either((t) => t.common.close) }).click();
  await expect(dialog).toHaveCount(0);
}

async function checkSwipe(page, phone) {
  await page.goto('/atlas/review?mode=swipe');
  await page.waitForLoadState('networkidle');
  await expect(h1(page)).toHaveText(either((t) => t.atlas.review.title));
  const bar = page.getByTestId('swipe-actions-bar');
  await expect(bar.or(page.locator('.empty-state').first())).toBeVisible({ timeout: 10000 });
  if (!(await bar.count())) return;
  await expect(bar.getByTestId('swipe-reject-btn')).toBeEnabled();
  await checkRawData(page, phone);
  await checkGallery(page);
}

async function checkList(page) {
  await page.getByTestId('review-mode-list').click();
  await expect(page.getByTestId('list-bulk-toolbar')).toBeVisible();
  await expect(page.getByTestId('list-bulk-reject')).toBeDisabled();
  const rows = page.locator('.data-table__row');
  await expect(rows.first().or(page.locator('.empty-state').first())).toBeVisible({ timeout: 10000 });
  if (!(await rows.count())) return;
  await rows.first().locator('[data-column="name"]').click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await drawer.getByTestId('side-drawer-close').click();
  await expect(drawer).toHaveCount(0);
}

async function checkOtherModes(page) {
  for (const mode of ['events', 'updated']) {
    await page.getByTestId(`review-mode-${mode}`).click();
    await expect(page).toHaveURL(new RegExp(`mode=${mode}`));
    await expect(page.locator('.data-table').first()).toBeVisible({ timeout: 10000 });
  }
}

const PAGES = [
  ['/atlas/find', (t) => t.lookup.find.title],
  ['/atlas/duplicates', (t) => t.atlas.duplicates.title],
  ['/atlas/auto-matched', (t) => t.atlas.auto_matched.title],
];

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`P5 Atlas review (${name})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('review queue: swipe, list, events, updated', async ({ page }) => {
      const collector = createErrorCollector(page);
      await checkSwipe(page, name === 'phone');
      await checkList(page);
      await checkOtherModes(page);
      collector.assertNoErrors(expect, 'Atlas review');
    });

    test('find, duplicates and auto-matched', async ({ page }) => {
      const collector = createErrorCollector(page);
      for (const [path, title] of PAGES) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await expect(h1(page)).toHaveText(either(title));
      }
      collector.assertNoErrors(expect, 'Atlas find, duplicates, auto-matched');
    });
  });
}
