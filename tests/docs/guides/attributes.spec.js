const { test, expect, guide, goto } = require("../support/capture");
const { idle } = require("../../visual/support/state");
const { ROWS, assertSeedRows, toastGone, headerButton } = require("./helpers");

// Guide "Attributes": the attribute sets, one set, the attribute list, a new attribute and its options. Creates the
// select attribute `docs_finish` with the option `docs-matte` and deletes the attribute at the end; the option goes
// with it.
const { shot } = guide("attributes");

const CODE = "docs_finish";
const SEED_SETS = ["Bundle", "Custom", "Default", "Furniture", "Premium Collection"];
// The 27 attributes of the demo catalogue plus `mpn`, which the backend creates on its own.
const SEED_CODES = (
  "name description short_description url_key badge brand subname subname2 size_table og_image mpn extension " +
  "meta_title meta_description rich_content canonical_url dimensions_depth dimensions_height dimensions_width " +
  "series options customizable max_limit_bundle min_limit_bundle weight_kg is_handcrafted material_composition " +
  "specifications"
).split(" ");
const ADD_GROUP = 'role=button[name="Add Attribute Group"]'; // pim.add_attribute_group
const ATTRIBUTE_CODE = "Attribute Code"; // pim.feature_code
const TYPE = "Type"; // pim.feature_type
const TYPE_SELECT = "Select"; // pim.type_select
const NAME = /^Name \(/; // pim.name, one field per language
const ADD_OPTION = "Add Option"; // pim.add_option
const OPTION_CODE = "Option Code"; // pim.option_code
const DEFAULT_LABEL = "Default Label"; // pim.default_label
const SAVE = "Save"; // common.save
const DELETE = "Delete"; // common.delete
const OPTIONS = ".options-manager";
const FURNITURE = `${ROWS}:has([role="gridcell"]:text-is("Furniture"))`;
const field = (label) => `.form-field:has(label:text-is("${label}"))`;

async function searchAttributes(page, text) {
  await page.locator(".feature-list__search input").fill(text);
  await page.waitForTimeout(400); // the list fetches 300 ms after the last key
  await idle(page);
}

async function deleteAttribute(page) {
  await headerButton(page, DELETE).click();
  await page.getByTestId("confirm-dialog-confirm").click();
  await page.waitForURL(/\/pim\/features\/?$/);
  await toastGone(page);
}

// A run that failed half-way leaves the attribute behind.
async function removeLeftover(page) {
  await goto(page, "/pim/features", { ready: ROWS });
  await searchAttributes(page, CODE);
  const leftover = page.locator(ROWS).filter({ hasText: CODE });
  if (!(await leftover.count())) return;
  await leftover.first().click();
  await page.waitForURL(`**/pim/features/${CODE}`);
  await deleteAttribute(page);
}

test("attributes", async ({ page }) => {
  await test.step("Attribute sets", async () => {
    await removeLeftover(page);
    await goto(page, "/pim/feature-sets", { ready: ROWS });
    await assertSeedRows(page, "the attribute set list", { column: 1, isSeed: (name) => SEED_SETS.includes(name) });
    await shot(page, "01-attribute-sets", { callouts: [{ target: FURNITURE, label: "1" }] });
  });

  await test.step("One attribute set", async () => {
    await page.click(FURNITURE);
    await page.waitForURL("**/pim/feature-sets/furniture");
    await page.locator(".feature-row").first().waitFor();
    // The groups start below the fold: the shot is the page scrolled down to them.
    await page.locator(ADD_GROUP).evaluate((button) => button.scrollIntoView({ block: "center" }));
    await shot(page, "02-attribute-set", {
      callouts: [
        { target: ADD_GROUP, label: "1" },
        { target: ".feature-row >> nth=0", label: "2" },
      ],
    });
  });

  await test.step("Attribute list", async () => {
    await goto(page, "/pim/features", { ready: ROWS });
    await assertSeedRows(page, "the attribute list", { column: 0, isSeed: (code) => SEED_CODES.includes(code) });
    await shot(page, "03-attributes");
  });

  await test.step("New attribute with a code, a type and a name", async () => {
    await goto(page, "/pim/features/create", { ready: ".form-grid" });
    await page.getByLabel(ATTRIBUTE_CODE).fill(CODE);
    await page.getByRole("combobox", { name: TYPE, exact: true }).click();
    await page.getByRole("option", { name: TYPE_SELECT, exact: true }).click();
    await page.getByRole("textbox", { name: NAME }).first().fill("Docs Finish");
    // Choosing Select loads the options of an attribute that does not exist yet: the error toast has to go first.
    await idle(page);
    await expect(page.locator(".notification")).toHaveCount(0, { timeout: 10000 });
    await shot(page, "04-new-attribute", {
      callouts: [
        { target: field(ATTRIBUTE_CODE), label: "1" },
        { target: field(TYPE), label: "2" },
      ],
    });
  });

  await test.step("Attribute saved, one option added", async () => {
    const options = page.locator(OPTIONS);
    await headerButton(page, SAVE).click();
    await page.waitForURL(`**/pim/features/${CODE}`);
    await toastGone(page);
    await options.getByRole("button", { name: ADD_OPTION }).click();
    await options.getByLabel(OPTION_CODE).fill("docs-matte");
    await options.getByLabel(DEFAULT_LABEL).fill("Matte");
    await options.getByRole("button", { name: SAVE }).click();
    await expect(options.locator(".options-table__row")).toHaveCount(1);
    await toastGone(page);
    await shot(page, "05-attribute-options", { element: OPTIONS });
  });

  await test.step("Restore: delete the attribute", async () => {
    await deleteAttribute(page);
    await searchAttributes(page, CODE);
    await expect(page.locator(ROWS)).toHaveCount(0);
  });
});
