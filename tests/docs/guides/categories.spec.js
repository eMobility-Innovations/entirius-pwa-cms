const { test, expect, guide, goto } = require("../support/capture");
const { toastGone, headerButton } = require("./helpers");

// Guide "Categories": the category tree, a new category, its page and its place in the tree. Creates the category
// `docs-reading-chairs` under Chairs and deletes it at the end.
const { shot } = guide("categories");

const IDX = "docs-reading-chairs";
const CATEGORY = "Docs Reading Chairs";
const PARENT = "Parent category"; // pim.parent
const NAME = /^Name \(/; // pim.name, one field per language
const COLLAPSE_ALL = "Collapse All"; // pim.collapse_all
const EDIT = "Edit"; // common.edit
const SAVE = "Save"; // common.save
const DELETE = "Delete"; // common.delete
const NODE = ".tree-node__row";
const node = (name) => `${NODE}:has(.tree-node__name:text-is("${name}"))`;
const toggle = (name) => `${node(name)} button[aria-expanded]`;
const field = (label) => `.form-field:has(label:text-is("${label}"))`;

// The tree with one branch open: the CMS remembers open branches, so everything is collapsed first.
async function openTree(page, ...path) {
  await goto(page, "/pim/categories", { ready: NODE });
  await page.getByRole("button", { name: COLLAPSE_ALL }).click();
  for (const name of path) await page.click(toggle(name));
}

async function deleteCategory(page) {
  await page.locator(node(CATEGORY)).getByRole("button", { name: EDIT, exact: true }).click();
  await page.waitForURL(`**/pim/categories/${IDX}`);
  await headerButton(page, DELETE).click();
  await page.getByTestId("confirm-dialog-confirm").click();
  await page.waitForURL(/\/pim\/categories\/?$/);
  await toastGone(page);
  await page.locator(NODE).first().waitFor();
  await expect(page.locator(node(CATEGORY))).toHaveCount(0);
}

// A run that failed half-way leaves the category behind.
async function removeLeftover(page) {
  await openTree(page, "Root", "Chairs");
  if (await page.locator(node(CATEGORY)).count()) await deleteCategory(page);
}

test("categories", async ({ page }) => {
  await test.step("Category tree with one branch open", async () => {
    await removeLeftover(page);
    await openTree(page, "Root", "Sofas");
    await shot(page, "01-category-tree", { callouts: [{ target: toggle("Sofas"), label: "1" }] });
  });

  await test.step("New category with an IDX, a parent and a name", async () => {
    await goto(page, "/pim/categories/create", { ready: ".form-grid" });
    await page.getByLabel("IDX").fill(IDX);
    await page.getByRole("combobox", { name: PARENT }).click();
    await page.getByRole("option", { name: "Chairs (chairs)", exact: true }).click();
    await page.getByRole("textbox", { name: NAME }).first().fill(CATEGORY);
    await shot(page, "02-new-category", {
      callouts: [
        { target: field("IDX"), label: "1" },
        { target: field(PARENT), label: "2" },
      ],
    });
  });

  await test.step("Category saved", async () => {
    await headerButton(page, SAVE).click();
    await page.waitForURL(`**/pim/categories/${IDX}`);
    await page.locator('[role="tablist"]').waitFor();
    await toastGone(page);
    await shot(page, "03-category-detail", { callouts: [{ target: '[role="tablist"]', label: "1" }] });
  });

  await test.step("The new category in the tree", async () => {
    await openTree(page, "Root", "Chairs");
    await shot(page, "04-category-in-tree", { element: node(CATEGORY), padding: 24 });
  });

  await test.step("Restore: delete the category", async () => {
    await deleteCategory(page);
  });
});
