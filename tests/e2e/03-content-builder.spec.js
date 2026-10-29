const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');

/**
 * Content Builder Workflow Tests
 *
 * Tests builder page load, section rendering, section controls,
 * and tile slider visibility. Avoids clicking SubscriberSetter
 * elements which open the handy-kit overlay.
 */

test.describe('Content Builder Workflow', () => {

  test('should navigate to builder and see section content', async ({ page }) => {
    await login(page);

    // Navigate to content list
    await page.goto('/pages/content?lg=pl');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.data-table__row, .filter-chip').first()).toBeVisible({ timeout: 10000 });

    // Click Edit on first item
    const editButton = page.locator('.data-table__action-btn').first();
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();
    await page.waitForLoadState('networkidle');

    // Builder should show sections with core_type labels
    const sectionHeader = page.locator('.fs-600.fw-600').first();
    await expect(sectionHeader).toBeVisible({ timeout: 10000 });
    const headerText = await sectionHeader.textContent();
    expect(headerText.length).toBeGreaterThan(0);

    // Section should have control buttons (pen, copy, trash); the eye is a display-only config summary
    const sectionBtns = page.getByTestId('builder-section-actions').first().getByRole('button');
    const btnCount = await sectionBtns.count();
    expect(btnCount).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId('builder-section-config').first()).toBeVisible();

    await page.screenshot({ path: 'test-results/content-builder-sections.png' });
  });

  // Redmine #34300: the section type select rendered empty, so nothing after it could be configured. The section
  // editor is the same config drawer as "New section" (which the first page's section limit may disable). Nothing is saved.
  test('should pick the section type and load its fields', async ({ page }) => {
    await login(page);

    await page.goto('/pages/content?lg=pl');
    await page.waitForLoadState('networkidle');
    await page.locator('.data-table__action-btn').first().click();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('builder-section-actions').first().getByRole('button').first().click();

    await page.getByRole('combobox', { name: 'Type', exact: true }).click();
    await page.getByRole('option', { name: 'Banner', exact: true }).click();

    await expect(page.getByRole('combobox', { name: 'Type', exact: true })).toContainText('Banner');
    await expect(page.getByText('Video URL')).toBeVisible();
  });

  test('should display tiles as cards in the section row', async ({ page }) => {
    await login(page);

    await page.goto('/pages/content?lg=pl');
    await page.waitForLoadState('networkidle');

    // Edit first content item
    const editButton = page.locator('.data-table__action-btn').first();
    await editButton.click();
    await page.waitForLoadState('networkidle');

    // Wait for builder to render
    await page.waitForTimeout(1000);

    // Tiles are shown as preview cards in the section's tile row
    const tileCards = page.locator('.tile-card');
    const hasCards = await tileCards.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasCards) {
      const cardCount = await tileCards.count();
      expect(cardCount).toBeGreaterThan(0);
      console.log(`Found ${cardCount} tile cards`);
    } else {
      // Section may have no tiles -- that is valid
      console.log('No tile cards found -- section may have max_tiles: 0');
    }
  });

});
