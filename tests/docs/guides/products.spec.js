const { test, expect, guide, goto } = require("../support/capture");
const { idle } = require("../../visual/support/state");
const { ROWS, assertSeedRows, toastGone } = require("./helpers");

// Guide "Products": the product list, the create form, the new product and its name. Creates DOCS-CHAIR-01 in the
// default channel and deletes it at the end. The delete removes the product from the channel; the SKU record stays
// and the next run reuses it. It shows in no list.
//
// Every feature set requires a name on create, and the create form takes it as rich text: the new product opens
// with markup in its title until the name is typed again on the product page. So the name is edited first
// (04-edit-name) and the page shot (03-product-created) shows the product after that save.
const { shot } = guide("products");

const SKU = "DOCS-CHAIR-01";
const FIRST_NAME = "Docs Chair";
const NAME = "Docs Lounge Chair";
const DEMO_SKU_PREFIX = "ENT-";
const SKU_COLUMN = { column: 2, isSeed: (sku) => sku.startsWith(DEMO_SKU_PREFIX) };
const CREATE_PRODUCT = "Create product"; // pim.create_product
const FEATURE_SET = "Feature set"; // pim.feature_set
const SAVE = "Save"; // common.save
const UNSAVED = "Unsaved changes"; // unsaved.changes
const FAB = '[data-fid="fab"]';
const CREATE_CARD = ".basic-card >> nth=0";
const DETAIL = ".product-layout__content";
const TITLE = '[data-fid="page-title"]';

async function searchProducts(page, text) {
  await page.locator(".product-list__search input").fill(text);
  await idle(page);
}

async function deleteProduct(page) {
  await page.getByTestId("pim-product-delete").click();
  await page.getByTestId("confirm-dialog-confirm").click();
  await page.waitForURL(/\/pim\/products\/?$/);
  await toastGone(page);
}

// A run that failed half-way leaves the product behind.
async function removeLeftover(page) {
  await searchProducts(page, SKU);
  const leftover = page.locator(ROWS).filter({ hasText: SKU });
  if (!(await leftover.count())) return;
  await leftover.first().click();
  await page.waitForURL(`**/pim/products/${SKU}`, { timeout: 15000 });
  await deleteProduct(page);
}

// A rich-text field: it takes key presses, not a filled value, and hands its value to the form 50 ms after the
// last key. A save before that finds the name empty.
async function typeRequiredName(page) {
  await page.getByTestId("required-attributes").locator('[contenteditable="true"]').pressSequentially(FIRST_NAME);
  await page.waitForTimeout(250);
}

const save = (page) => page.locator(".page-header").getByRole("button", { name: SAVE }).click();

test("products", async ({ page }) => {
  await test.step("Product list, demo products only", async () => {
    await goto(page, "/pim/products");
    await removeLeftover(page);
    await searchProducts(page, DEMO_SKU_PREFIX);
    await assertSeedRows(page, "the product list", SKU_COLUMN);
    await shot(page, "01-product-list", {
      callouts: [
        { target: ".product-list__search", label: "1" },
        { target: '[data-testid="pim-channel-select"]', label: "2" },
        { target: FAB, label: "3" },
      ],
    });
  });

  await test.step("Create form with SKU and feature set", async () => {
    await page.click(FAB);
    await page.click(`.floating-actions__action[aria-label="${CREATE_PRODUCT}"]`);
    await page.getByLabel("SKU").fill(SKU);
    await page.getByRole("combobox", { name: FEATURE_SET }).click();
    await page.getByRole("option", { name: "Furniture" }).click();
    await shot(page, "02-create-form", {
      element: CREATE_CARD,
      callouts: [
        { target: '.basic-card .form-field:has-text("SKU")', label: "1" },
        { target: `.basic-card .form-field:has-text("${FEATURE_SET}")`, label: "2" },
      ],
    });
  });

  await test.step("Required name typed, product saved, name edited", async () => {
    await typeRequiredName(page);
    await save(page);
    await page.waitForURL(`**/pim/products/${SKU}`, { timeout: 15000 });
    await page.locator('[role="tablist"]').waitFor();
    await toastGone(page);
    await page.locator(DETAIL).getByRole("textbox", { name: "Name" }).fill(NAME);
    await shot(page, "04-edit-name", {
      element: `${DETAIL} .basic-card >> nth=0`,
      callouts: [{ target: `${DETAIL} .form-field:has-text("Name")`, label: "1" }],
    });
    await save(page);
    await expect(page.getByText(UNSAVED)).toHaveCount(0);
    await toastGone(page);
  });

  await test.step("The saved product", async () => {
    await page.locator(TITLE).scrollIntoViewIfNeeded(); // the crop above scrolled the page
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(NAME);
    await shot(page, "03-product-created", { callouts: [{ target: TITLE, label: "1" }] });
  });

  await test.step("Restore: delete the product", async () => {
    await deleteProduct(page);
  });
});
