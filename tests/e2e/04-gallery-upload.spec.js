const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const path = require('path');
const fs = require('fs');

/**
 * Gallery Upload Workflow Test
 * Tests image upload, verification, pagination, and cleanup
 */

test.describe('Gallery Upload Workflow', () => {
  // One alt text per run: the delete test finds the image the upload test added by it, never another tile of the
  // shared stack's seeded gallery.
  const uploadedImageAlt = `test-${Date.now()}`;
  test.describe.configure({ mode: 'serial' });

  test('should upload image to gallery and verify it appears', async ({ page }) => {
    // Step 1: Login
    await login(page);

    // Step 2: Navigate to Gallery via URL
    await page.goto('/pages/gallery');
    await page.waitForLoadState('networkidle');

    // Verify gallery loaded (look for the MediaTile grid or the tag filter chips)
    await expect(page.locator('.media-tile, .filter-chip, [class*="gallery"]').first()).toBeVisible({ timeout: 10000 });

    // Step 3: Open FAB menu
    const fabTrigger = page.locator('.floating-actions__trigger');
    await expect(fabTrigger).toBeVisible({ timeout: 5000 });
    await fabTrigger.click();

    // Step 4: Click "Add photo" action (first FAB action - upload icon)
    const addPhotoAction = page.locator('.floating-actions__action--primary').first();
    await expect(addPhotoAction).toBeVisible({ timeout: 3000 });
    await addPhotoAction.click();

    // Step 5: Verify the upload dialog is open (its drop zone picks a file on click)
    const uploadDialog = page.getByRole('dialog');
    const selectFromDiskButton = uploadDialog.getByRole('button', { name: /^(Upuść obraz tutaj|Drop image here)$/ });
    await expect(selectFromDiskButton).toBeVisible({ timeout: 5000 });

    // Step 6: Upload the test image via hidden file input
    const testImagePath = path.join(__dirname, '../fixtures/testimg.png');

    if (!fs.existsSync(testImagePath)) {
      throw new Error(`Test image not found at: ${testImagePath}`);
    }

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      selectFromDiskButton.click()
    ]);
    await fileChooser.setFiles(testImagePath);

    // Wait for image preview to appear
    await page.waitForTimeout(1000);

    // Step 7: Fill in alt text
    const altTextInput = uploadDialog.locator('input[type="text"]').first();
    await altTextInput.fill(uploadedImageAlt);

    // Step 8: Click "Upload" button (PL: "Wgraj")
    const uploadButton = uploadDialog.getByRole('button', { name: /^(Wgraj|Upload)$/ });
    await expect(uploadButton).toBeVisible({ timeout: 5000 });
    await uploadButton.click();

    // Step 9: Wait for upload to complete and return to gallery view
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Verify we're back on the gallery page (read mode with gallery grid)
    await expect(page.locator('.media-tile').first()).toBeVisible({ timeout: 10000 });

    // Step 10: Verify gallery has images
    const imageCount = await page.locator('.media-tile').count();
    expect(imageCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/gallery-after-upload.png' });
  });

  test('should test gallery pagination if available', async ({ page }) => {
    await login(page);

    // Navigate to Gallery via URL
    await page.goto('/pages/gallery');
    await page.waitForLoadState('networkidle');

    // Check if pagination exists
    const paginationExists = await page.locator('[class*="pagination"]').count() > 0;

    if (paginationExists) {
      // Click next page button if available
      const nextButton = page.locator('[class*="pagination"] button').last();
      if ((await nextButton.isVisible()) && (await nextButton.isEnabled())) {
        await nextButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await page.screenshot({ path: 'test-results/gallery-pagination-page2.png' });

        // Go back to first page
        const prevButton = page.locator('[class*="pagination"] button').first();
        if ((await prevButton.isVisible()) && (await prevButton.isEnabled())) {
          await prevButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    } else {
      console.log('No pagination found - gallery has single page');
    }
  });

  test('should delete uploaded test image and logout', async ({ page }) => {
    await login(page);

    // Navigate to Gallery via URL
    await page.goto('/pages/gallery');
    await page.waitForLoadState('networkidle');

    // The tile of the uploaded image (newest first), found by its alt text; hover it: its actions show on hover and focus
    const uploadedTile = page.locator('.media-tile').filter({ has: page.locator(`img[alt="${uploadedImageAlt}"]`) });
    await expect(uploadedTile).toHaveCount(1, { timeout: 10000 });
    await uploadedTile.hover();

    // Click the tile's delete button (PL: "Usuń zdjęcie"), then confirm
    await uploadedTile.getByRole('button', { name: /^(Usuń zdjęcie|Delete photo)$/ }).click();
    await page.getByTestId('confirm-dialog-confirm').click();
    await expect(uploadedTile).toHaveCount(0, { timeout: 10000 });

    // Logout lives in the user menu (the header's user button)
    await page.locator('[data-fid="user-button"]').click();
    const logoutButton = page.getByRole('menuitem', { name: /^(Wyloguj|Log out)$/ });
    if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutButton.click();

      // Wait for logout redirect to complete before checking login form
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      // Verify we're back on login page
      await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });
      console.log('Logged out successfully');
    } else {
      console.log('Logout button not found at expected location');
    }
  });

});
