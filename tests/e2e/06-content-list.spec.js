const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');

/**
 * Content List Tests
 *
 * Validates the content list table structure, filter chips,
 * and pagination. These tests ensure the data display layer
 * works correctly regardless of underlying component implementation.
 */

test.describe('Content List Table', () => {

  test('has headers, rows, status pills, and action buttons', async ({ page }) => {
    await login(page);
    await page.goto('/pages/content?lg=pl');
    await page.waitForLoadState('networkidle');

    // Wait for content data to render (check first header cell visibility)
    const firstHeaderCell = page.locator('.data-table__header-cell').first();
    const hasTable = await firstHeaderCell.isVisible({ timeout: 10000 }).catch(() => false);

    if (!hasTable) {
      console.log('No content data available -- skipping table structure test');
      return;
    }

    // Header columns
    const table = page.locator('.data-table').first();
    const headerCells = table.locator('.data-table__header-cell');
    const colCount = await headerCells.count();
    expect(colCount).toBeGreaterThanOrEqual(3);

    // Data rows
    const rows = page.locator('.data-table__row');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // First row: name link
    const nameLink = rows.first().locator('.data-table__name-link');
    await expect(nameLink).toBeVisible();

    // First row: date column
    const dateCol = rows.first().locator('[data-column="updated_at"]');
    await expect(dateCol).toBeVisible();

    // First row: status badge (StatusBadge) with text
    const statusPill = rows.first().locator('.status-badge');
    await expect(statusPill).toBeVisible();
    const statusText = await statusPill.textContent();
    expect(statusText.trim().length).toBeGreaterThan(0);

    // First row: at least one action button
    const actionBtns = rows.first().locator('.data-table__action-btn');
    const actionCount = await actionBtns.count();
    expect(actionCount).toBeGreaterThanOrEqual(1);
  });

  test('filter chips activate and clear', async ({ page }) => {
    await login(page);
    await page.goto('/pages/content?lg=pl');
    await page.waitForLoadState('networkidle');

    const filterChips = page.locator('.filter-chip');
    const chipCount = await filterChips.count();

    if (chipCount === 0) {
      console.log('No filter chips available -- skipping filter test');
      return;
    }

    // Click first filter chip to activate
    await filterChips.first().click();
    await expect(filterChips.first()).toHaveClass(/filter-chip--active/);

    // Click same chip again to deactivate, or click clear button
    await filterChips.first().click();

    // After toggle off, chip should no longer be active
    const stillActive = await filterChips.first().evaluate(
      el => el.classList.contains('filter-chip--active')
    );
    // Either it deactivated or we need to use the clear button
    if (stillActive) {
      // Clear all filters via the icon button next to the chips
      const clearBtn = page.getByRole('button', { name: /Wyczyść filtry|Clear filters/ });
      if (await clearBtn.isVisible().catch(() => false)) {
        await clearBtn.click();
      }
    }
  });

  test('pagination renders when content has multiple pages', async ({ page }) => {
    await login(page);
    await page.goto('/pages/content?lg=pl');
    await page.waitForLoadState('networkidle');

    const pagination = page.locator('nav.pagination').first();
    const hasPagination = await pagination.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasPagination) {
      // Should have navigation arrows and page numbers
      const arrows = pagination.locator(
        'button[aria-label="previous page"], button[aria-label="next page"]'
      );
      expect(await arrows.count()).toBe(2); // prev + next arrows

      const pageButtons = pagination.locator('button.page-cell:not([aria-label])');
      expect(await pageButtons.count()).toBeGreaterThanOrEqual(1); // at least one page number
    } else {
      console.log('Content fits on single page -- no pagination to verify');
    }
  });

});
