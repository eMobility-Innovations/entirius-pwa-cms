const { test, guide, goto } = require("../support/capture");
const { ROWS, assertSeedRows } = require("./helpers");

// Guide "Blog posts": the authors list, an author, and the authors and publish actions of a blog post. Writes
// nothing: the author picker is opened and closed, nothing is saved.
const { shot } = guide("blog-posts");

const SEED_AUTHORS = ["Anna Kowalska", "Jan Nowak", "Maria Wisniewska", "Tomasz Kwiatkowski", "Ewa Lewandowska"];
const POST = "/pages/content/blog-post/c0000001-0007-4000-8000-000000000007?lg=en";
const AUTHORS = 'role=combobox[name="Authors"]'; // authors.primary
const CO_AUTHORS = 'role=combobox[name="Co-authors"]'; // authors.co_authors
const SAVE_DRAFT = 'role=button[name="Save draft"]'; // builder.save_draw
const PUBLISH = 'role=button[name="Save and publish"]'; // builder.publish_document
const PHOTO = ".author-photo-preview";
const AUTHOR_PANEL = ".builder-author-panel";

test("blog-posts", async ({ page }) => {
  await test.step("Authors list", async () => {
    await goto(page, "/pages/authors", { ready: ROWS });
    await assertSeedRows(page, "the authors list", { column: 0, isSeed: (name) => SEED_AUTHORS.includes(name) });
    await shot(page, "01-authors-list", { callouts: [{ target: '[data-fid="fab"]', label: "1" }] });
  });

  await test.step("Author detail", async () => {
    await page.locator(ROWS).filter({ hasText: SEED_AUTHORS[0] }).click();
    await page.locator(PHOTO).waitFor();
    await shot(page, "02-author-detail", {
      callouts: [
        { target: PHOTO, label: "1" },
        { target: '.page-header >> role=button[name="Save"]', label: "2" },
      ],
    });
  });

  await test.step("Authors of a blog post", async () => {
    await goto(page, POST, { ready: '[data-testid="builder-advanced-toggle"]' });
    await page.click('[data-testid="builder-advanced-toggle"]');
    await page.click(`${AUTHOR_PANEL}__header`);
    await shot(page, "03-post-authors", {
      element: AUTHOR_PANEL,
      padding: 4,
      callouts: [
        { target: AUTHORS, label: "1" },
        { target: CO_AUTHORS, label: "2" },
      ],
    });
  });

  await test.step("Author picker, opened and closed", async () => {
    await page.click(AUTHORS);
    await page.getByRole("option").first().waitFor();
    await shot(page, "04-author-picker", { callouts: [{ target: AUTHORS, label: "1" }] });
    await page.keyboard.press("Escape");
  });

  await test.step("Draft and publish actions", async () => {
    await shot(page, "05-publish-actions", {
      element: ".builder-actions",
      callouts: [
        { target: SAVE_DRAFT, label: "1" },
        { target: PUBLISH, label: "2" },
      ],
    });
  });
});
