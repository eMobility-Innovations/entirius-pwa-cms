const fs = require("fs");
const os = require("os");
const path = require("path");
const { test, expect, guide, goto } = require("../support/capture");
const { toastGone } = require("./helpers");

// Guide "Media": the gallery, the upload dialog and the uploaded photo. Uploads a copy of the first seeded image with
// the alt text "Docs sample photo" and deletes it at the end.
const { shot } = guide("media");

const ALT = "Docs sample photo";
const E2E_ALT_PREFIX = "test-"; // the alt text of the e2e upload
const ADD_PHOTO = "Add photo"; // images.add_photo
const DROP_ZONE = "Drop image here"; // gallery.drop_files_here
const ALT_TEXT = "Alt text"; // gallery.alt_text
const UPLOAD = "Upload"; // gallery.upload
const DELETE_PHOTO = "Delete photo"; // gallery.delete_photo
const TILE = ".media-tile";
const DOCS_TILE = `${TILE}:has(img[alt="${ALT}"])`;
const DIALOG = '[role="dialog"]:visible';

// Every tile of that alt text on the first page: runs that failed half-way may have left more than one.
async function removeDocsPhotos(page) {
  const tiles = page.locator(DOCS_TILE);
  for (let left = await tiles.count(); left > 0; left -= 1) {
    await tiles.first().hover();
    await tiles.first().getByRole("button", { name: DELETE_PHOTO }).click();
    await page.getByTestId("confirm-dialog-confirm").click();
    await expect(tiles).toHaveCount(left - 1);
    await toastGone(page);
  }
}

async function assertSeedTiles(page) {
  const alts = await page.locator(`${TILE} img`).evaluateAll((images) => images.map((image) => image.alt));
  if (alts.length && !alts.some((alt) => alt.startsWith(E2E_ALT_PREFIX))) return;
  throw new Error("INFRA: the gallery shows rows outside the seed (run make seed)");
}

// The upload source: the first image of the gallery, saved to the temp folder.
async function downloadFirstImage(page) {
  const url = await page
    .locator(`${TILE} img`)
    .first()
    .evaluate((image) => image.currentSrc || image.src);
  const response = await page.request.get(url);
  expect(response.ok()).toBeTruthy();
  const file = path.join(os.tmpdir(), `docs-sample-photo${path.extname(new URL(url).pathname)}`);
  fs.writeFileSync(file, await response.body());
  return file;
}

test("media", async ({ page }) => {
  let photo;

  await test.step("Gallery", async () => {
    await goto(page, "/pages/gallery", { ready: TILE });
    await removeDocsPhotos(page);
    await assertSeedTiles(page);
    await shot(page, "01-gallery");
    photo = await downloadFirstImage(page);
  });

  await test.step("Upload dialog with a photo and its alt text", async () => {
    const dialog = page.locator(DIALOG);
    await page.click(".floating-actions__trigger");
    await page.click(`.floating-actions__action[aria-label="${ADD_PHOTO}"]`);
    const chooser = page.waitForEvent("filechooser");
    await dialog.getByRole("button", { name: DROP_ZONE }).click();
    await (await chooser).setFiles(photo);
    await dialog.getByLabel(ALT_TEXT).fill(ALT);
    await shot(page, "02-upload-dialog", {
      element: DIALOG,
      callouts: [{ target: `${DIALOG} .form-field:has-text("${ALT_TEXT}")`, label: "1" }],
    });
  });

  await test.step("The uploaded photo, first in the gallery", async () => {
    await page.locator(DIALOG).getByRole("button", { name: UPLOAD, exact: true }).click();
    await expect(page.locator(TILE).first().locator(`img[alt="${ALT}"]`)).toBeVisible();
    await toastGone(page);
    await shot(page, "03-uploaded-photo", { element: DOCS_TILE });
  });

  await test.step("Restore: delete the photo", async () => {
    await expect(page.locator(DOCS_TILE)).toHaveCount(1);
    await removeDocsPhotos(page);
  });
});
