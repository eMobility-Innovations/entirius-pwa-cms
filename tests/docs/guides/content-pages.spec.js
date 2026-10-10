const { test, expect, guide, goto } = require("../support/capture");
const { ROWS, assertSeedRows, toastGone } = require("./helpers");

// Guide "Content pages": the content list, a new static page, the section picker, the saved draft and a page with
// sections. Creates the static page "Docs Spring Lookbook" as a draft (a name only, no URL, no section) and deletes
// it at the end from the content list. Nothing is published.
const { shot } = guide("content-pages");

const PAGE_NAME = "Docs Spring Lookbook";
const SEED_PAGES = ["Home", "About Us", "Contact", "Product Showcase", "Blog Landing Page"];
const SHOWCASE = "/pages/content/static-page/c0000020-0001-4000-8000-000000000001?lg=en";
const STATIC_PAGE = "Static page"; // config_option.static-page
const NEW_SECTION = "New section"; // builder.new_section
const CREATE_NEW = "Create new"; // builder.post_draw
const SAVE_DRAFT = "Save draft"; // builder.save_draw
const PUBLISH = "Save and publish"; // builder.publish_document
const DELETE = "Delete"; // builder.delete
const FAB = '[data-fid="fab"]';
const ADVANCED = '[data-testid="builder-advanced-toggle"]';
const NAME_INPUT = ".builder-advanced-row input";
const SECTION_PICKER = ".handy-kit-core";
const SECTION_ACTIONS = '[data-testid="builder-section-actions"]';

async function openStaticPages(page) {
  await goto(page, "/pages/content?lg=en", { ready: ".content-list__chips" });
  await page.locator(".content-list__chips").getByRole("button", { name: STATIC_PAGE }).click();
  await page.locator(ROWS).first().waitFor();
}

const docsPageRows = (page) => page.locator(ROWS).filter({ hasText: PAGE_NAME });

// Every row of that name: runs that failed half-way may have left more than one.
async function removeDocsPages(page) {
  const rows = docsPageRows(page);
  for (let left = await rows.count(); left > 0; left -= 1) {
    await rows.first().getByRole("button", { name: DELETE }).click();
    await page.getByTestId("confirm-dialog-confirm").click();
    await expect(rows).toHaveCount(left - 1);
    await toastGone(page);
  }
}

test("content-pages", async ({ page }) => {
  await test.step("Content list, static pages", async () => {
    await openStaticPages(page);
    await removeDocsPages(page);
    await assertSeedRows(page, "the static-page list", { column: 0, isSeed: (name) => SEED_PAGES.includes(name) });
    await shot(page, "01-content-list", {
      callouts: [
        { target: ".content-list__chips", label: "1" },
        { target: FAB, label: "2" },
      ],
    });
  });

  await test.step("New static page with a name", async () => {
    await page.click(FAB);
    await page.click(`.floating-actions__action[aria-label="${STATIC_PAGE}"]`);
    await page.waitForURL(/\/pages\/content\/static-page\/?(\?.*)?$/);
    await page.click(ADVANCED);
    await page.fill(NAME_INPUT, PAGE_NAME);
    await shot(page, "02-new-page", {
      callouts: [
        { target: NAME_INPUT, label: "1" },
        { target: ADVANCED, label: "2" },
        { target: `.empty-state >> role=button[name="${NEW_SECTION}"]`, label: "3" },
      ],
    });
  });

  await test.step("Section picker, opened and closed", async () => {
    await page.locator(".empty-state").getByRole("button", { name: NEW_SECTION }).click();
    await page.locator(SECTION_PICKER).waitFor();
    await shot(page, "03-new-section", {
      callouts: [
        { target: `${SECTION_PICKER} .grid.grid-col-4 >> nth=0`, label: "1" },
        { target: `${SECTION_PICKER} >> role=button[name="Save"]`, label: "2" },
      ],
    });
    await page.click(`${SECTION_PICKER} nav .pointer`);
    await expect(page.locator(SECTION_PICKER)).toHaveCount(0);
  });

  await test.step("Page saved as a draft", async () => {
    await page.getByRole("button", { name: CREATE_NEW }).click();
    await page.waitForURL(/\/pages\/content\/static-page\/[0-9a-f-]{36}/, { timeout: 15000 });
    await toastGone(page);
    await shot(page, "04-page-draft", {
      callouts: [
        { target: `role=button[name="${SAVE_DRAFT}"]`, label: "1" },
        { target: `role=button[name="${PUBLISH}"]`, label: "2" },
      ],
    });
  });

  await test.step("A page with sections", async () => {
    await goto(page, SHOWCASE, { ready: SECTION_ACTIONS });
    await shot(page, "05-page-sections", {
      callouts: [
        { target: `${SECTION_ACTIONS} >> nth=0`, label: "1" },
        { target: '[data-testid="builder-order-pill"]', label: "2" },
      ],
    });
  });

  await test.step("Restore: delete the draft", async () => {
    await openStaticPages(page);
    await expect(docsPageRows(page)).toHaveCount(1);
    await removeDocsPages(page);
  });
});
