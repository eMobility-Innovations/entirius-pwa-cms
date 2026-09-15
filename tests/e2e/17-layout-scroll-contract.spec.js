const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * The shell clips, so a full-height page has to scroll itself.
 *
 * App.vue renders the route inside `.app-content-col.ov-h.router-container`,
 * within a `.layout` that is `overflow: hidden; height: 100%`, and hands the
 * route `class="h-100"`. A page root that fills the viewport and sets no
 * overflow of its own lays out at content height inside that fixed-height
 * clipping box, and everything past the fold becomes unreachable. That is a
 * real failure this panel shipped with, found in a browser by a person.
 *
 * jsdom applies no scoped SCSS and computes no layout, so a unit test cannot
 * catch it. This measures the compiled stylesheet in a real browser engine:
 * it scrolls the panel and looks for the last section.
 *
 * It builds the shell from the class names read out of App.vue rather than
 * repeating them, so the fixture follows the shell. If those names move, the
 * read below throws instead of quietly measuring markup the app no longer
 * renders.
 */

const ROOT = path.resolve(__dirname, "..", "..");
const DIST_CSS = path.join(ROOT, "dist", "css");

function shellFromAppVue() {
  const app = fs.readFileSync(path.join(ROOT, "src", "App.vue"), "utf8");
  const layout = app.match(/class="(layout[^"]*)"/);
  const container = app.match(/class="(app-content-col[^"]*router-container[^"]*)"/);
  if (!layout || !container) {
    throw new Error(
      "Could not find the layout/router-container classes in src/App.vue. " +
        "The shell moved: update this spec to match it, do not delete the spec."
    );
  }
  return { layout: layout[1], container: container[1] };
}

function compiledCss() {
  if (!fs.existsSync(DIST_CSS)) {
    throw new Error(
      `No compiled CSS at ${DIST_CSS}. This spec measures the built stylesheet — ` +
        "run `npm run build` first (`npm test` builds before it runs e2e)."
    );
  }
  return fs
    .readdirSync(DIST_CSS)
    .filter((f) => f.endsWith(".css"))
    .map((f) => fs.readFileSync(path.join(DIST_CSS, f), "utf8"))
    .join("\n");
}

function fixture({ layout, container }, css) {
  const rows = Array.from({ length: 60 }, (_, i) => `<p>row ${i}</p>`).join("");
  return `<!doctype html><html><head><style>
    html, body { margin: 0; height: 600px; }
    ${css}
  </style></head><body>
    <div class="${layout}">
      <div class="${container}">
        <div class="access-panel h-100">
          ${rows}
          <section id="last-section">Unassigned</section>
        </div>
      </div>
    </div>
  </body></html>`;
}

test.describe("layout contract: a full-height page scrolls itself", () => {
  test("the access panel is its own scroll container and its last section is reachable", async ({
    page,
  }) => {
    await page.setContent(fixture(shellFromAppVue(), compiledCss()));

    const panel = page.locator(".access-panel");
    await expect(panel).toBeVisible();

    const box = await panel.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    // The fixture is deliberately taller than the shell, so the panel must
    // report content it cannot show at once. If these are equal the panel grew
    // to content height instead of scrolling, which is the bug.
    expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);

    // And it must actually scroll, not merely overflow.
    const scrolled = await panel.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      return el.scrollTop;
    });
    expect(scrolled).toBeGreaterThan(0);

    // The failure a person hit was the last section being unreachable. Look for it.
    const reachable = await page.locator("#last-section").evaluate((el) => {
      const panelBox = el.closest(".access-panel").getBoundingClientRect();
      const own = el.getBoundingClientRect();
      return own.top >= panelBox.top - 1 && own.bottom <= panelBox.bottom + 1;
    });
    expect(reachable).toBe(true);
  });
});
