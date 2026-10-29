const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');

/**
 * Field hints switch (plan 60): the user menu's „Podpowiedzi przy polach” item hides every hint mark, the choice
 * survives a reload, and the spec puts back the value it found (the switch is a saved profile preference) — only
 * when it changed it and the page is still signed in, so a failed login keeps its own error.
 * Opens the FAQ group form (its Channels field carries a hint); never saves the form.
 */

const HINTS_ITEM = /^(Podpowiedzi przy polach|Field hints)$/;
const FORM = '/faq/groups/create';
const marks = (page) => page.locator('.basic-tooltip__help');
const hintsItem = (page) => page.getByRole('menuitemcheckbox', { name: HINTS_ITEM });
const userButton = (page) => page.locator('[data-fid="user-button"]');

// The profile's value before the test first opened the switch; null = not touched.
let foundHints = null;

async function openForm(page) {
  await page.goto(FORM);
  await page.waitForLoadState('networkidle');
}

async function setHints(page, on) {
  await userButton(page).click();
  const item = hintsItem(page);
  const current = await item.getAttribute('aria-checked');
  foundHints ??= current === 'true';
  if (current === String(on)) {
    await page.keyboard.press('Escape');
    return;
  }
  await item.click();
}

test.describe('Field hints switch', () => {
  test.afterEach(async ({ page }) => {
    const found = foundHints;
    if (found !== null && (await userButton(page).isVisible())) await setHints(page, found);
    foundHints = null;
  });

  test('turning hints off hides the marks, keeps the choice after a reload', async ({ page }) => {
    await login(page);
    await openForm(page);
    await setHints(page, true);
    await expect(marks(page).first()).toBeVisible();

    await setHints(page, false);
    await expect(marks(page)).toHaveCount(0);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
    await expect(marks(page)).toHaveCount(0);
    await userButton(page).click();
    await expect(hintsItem(page)).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');
  });
});
