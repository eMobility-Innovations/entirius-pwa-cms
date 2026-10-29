const { test, expect } = require("@playwright/test");
const { login } = require("../helpers/auth");

const BOX = ".dedup-search-box";
const HINT = "[data-testid='dedup-search-drop-hint']";
const THUMB = "[data-testid='dedup-search-dropzone']";

// Builds a real DataTransfer carrying a real File inside the page, so the
// browser's own drag machinery decides whether our handlers fire.
async function makeFileDrag(page) {
  return page.evaluateHandle(() => {
    const dt = new DataTransfer();
    // 1x1 red PNG
    const b64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    dt.items.add(new File([bytes], "drop.png", { type: "image/png" }));
    return dt;
  });
}

test.describe("lookup drop zone", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/atlas/find");
    await page.waitForSelector(BOX);
  });

  test("the whole box highlights on dragover, not just the 42px thumb", async ({
    page,
  }) => {
    const box = page.locator(BOX);
    await expect(box).not.toHaveClass(/dedup-search-box--dragover/);

    const dt = await makeFileDrag(page);
    await box.dispatchEvent("dragenter", { dataTransfer: dt });
    await box.dispatchEvent("dragover", { dataTransfer: dt });

    await expect(box).toHaveClass(/dedup-search-box--dragover/);
    await expect(page.locator(THUMB)).toHaveClass(
      /image-picker-thumb__button--dragover/
    );
    await expect(page.locator(HINT)).toHaveText("Drop the photo here");
  });

  test("the highlight survives the drag crossing child elements", async ({
    page,
  }) => {
    const box = page.locator(BOX);
    const dt = await makeFileDrag(page);

    await box.dispatchEvent("dragenter", { dataTransfer: dt });
    // enter a child, then leave it — the naive boolean would go dark here
    const input = page.locator("[data-testid='dedup-search-input']");
    await input.dispatchEvent("dragenter", { dataTransfer: dt });
    await input.dispatchEvent("dragleave", { dataTransfer: dt });

    await expect(box).toHaveClass(/dedup-search-box--dragover/);
  });

  test("dropping a file anywhere on the box loads it as the query image", async ({
    page,
  }) => {
    const box = page.locator(BOX);
    const dt = await makeFileDrag(page);

    await box.dispatchEvent("dragenter", { dataTransfer: dt });
    await box.dispatchEvent("drop", { dataTransfer: dt });

    // preview replaces the upload icon inside the thumb
    await expect(page.locator(`${THUMB} img`)).toBeVisible();
    await expect(box).not.toHaveClass(/dedup-search-box--dragover/);
    // and the search button is now enabled by the image alone
    await expect(
      page.locator("[data-testid='dedup-search-submit']")
    ).toBeEnabled();
  });

  test("a text drag neither highlights nor is swallowed", async ({ page }) => {
    const box = page.locator(BOX);
    const dt = await page.evaluateHandle(() => {
      const d = new DataTransfer();
      d.items.add("hello", "text/plain");
      return d;
    });

    await box.dispatchEvent("dragenter", { dataTransfer: dt });
    await box.dispatchEvent("dragover", { dataTransfer: dt });

    await expect(box).not.toHaveClass(/dedup-search-box--dragover/);
  });
});
