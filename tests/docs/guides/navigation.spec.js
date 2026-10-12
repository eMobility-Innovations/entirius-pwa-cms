const { test, expect, guide, goto } = require("../support/capture");
const { ROWS, assertSeedRows } = require("./helpers");

// Guide "Navigation": the navigation list, the header and footer editors, the add-item dialog and the publish
// actions. Writes nothing: the dialog is filled and closed without adding the item, nothing is saved or published.
const { shot } = guide("navigation");

const SEED_MENUS = ["Main Navigation", "Footer"];
const HEADER = "/pages/layout-extender/header/c0000017-0001-4000-8000-000000000001";
const FOOTER = "/pages/layout-extender/footer/c0000019-0001-4000-8000-000000000001";
const ITEM_LABEL = "Label"; // layout_extender.label
const ITEM_URL = "URL"; // layout_extender.url
const SAVE_DRAFT = 'role=button[name="Save draft"]'; // builder.save_draw
const ADD_ITEM = '[data-testid="nav-editor-add-item"]';
const DIALOG = '[role="dialog"]:visible';
const URL_LINK = `${DIALOG} input[type="radio"][value="url"]`;

test("navigation", async ({ page }) => {
  await test.step("Navigation list", async () => {
    await goto(page, "/pages/layout-extender?lg=en", { ready: ROWS });
    await assertSeedRows(page, "the navigation list", { column: 0, isSeed: (name) => SEED_MENUS.includes(name) });
    await shot(page, "01-navigation-list", { callouts: [{ target: `${ROWS} >> nth=0`, label: "1" }] });
  });

  await test.step("Header editor", async () => {
    await goto(page, HEADER, { ready: ".nav-item" });
    await shot(page, "02-header-editor", {
      callouts: [
        { target: ".nav-item >> nth=0", label: "1" },
        { target: ADD_ITEM, label: "2" },
      ],
    });
  });

  await test.step("Add-item dialog, filled and closed", async () => {
    const dialog = page.locator(DIALOG);
    await page.click(ADD_ITEM);
    await dialog.getByRole("textbox", { name: ITEM_LABEL }).fill("Docs Sale");
    await page.check(URL_LINK);
    await dialog.getByRole("textbox", { name: ITEM_URL }).fill("https://example.com/sale");
    await shot(page, "03-add-item", {
      element: DIALOG,
      callouts: [
        { target: `${DIALOG} .form-field:has-text("${ITEM_LABEL}")`, label: "1" },
        { target: URL_LINK, label: "2" },
      ],
    });
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".nav-item")).toHaveCount(4);
  });

  await test.step("Footer editor", async () => {
    await goto(page, FOOTER, { ready: ".nav-empty" });
    await shot(page, "04-footer-editor", { callouts: [{ target: ADD_ITEM, label: "1" }] });
  });

  await test.step("Draft and publish actions", async () => {
    await goto(page, HEADER, { ready: ".nav-item" });
    await shot(page, "05-publish-actions", {
      element: ".page-header .flex.ai-ct.jc-fe",
      callouts: [
        { target: SAVE_DRAFT, label: "1" },
        { target: '[data-testid="nav-editor-publish"]', label: "2" },
      ],
    });
  });
});
