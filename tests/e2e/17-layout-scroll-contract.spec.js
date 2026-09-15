const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * The shell clips, so a full-height page has to scroll itself.
 *
 * App.vue renders the route inside `.app-content-col.ov-h.router-container`,
 * within a `.layout` that is `overflow: hidden; height: 100%`, and hands the
 * route `class="h-100"`. The shell clips on purpose and every page is expected
 * to provide its own scrolling. Nothing enforces that, and nothing warns: there
 * is no console message, and jsdom applies no scoped SCSS and computes no
 * layout, so a unit test asserting computed overflow passes whatever the
 * stylesheet actually says.
 *
 * These two cases pin the contract from both sides, using only the shell's own
 * compiled stylesheet and a page root styled inline:
 *
 *   1. a page root that fills the height and sets no overflow has content the
 *      viewer cannot reach — this is the hazard, and it is what the shell
 *      clipping MEANS;
 *   2. the same root with `overflow-y: auto` scrolls and its last child is
 *      reachable.
 *
 * If someone later makes the shell scroll instead, case 1 fails. If the height
 * chain into the route container breaks, case 2 fails.
 *
 * The class names are read out of App.vue rather than repeated here, so the
 * fixture follows the shell; if they move, this throws instead of quietly
 * measuring markup the app no longer renders.
 */

const ROOT = path.resolve(__dirname, "..", "..");
const DIST_CSS = path.join(ROOT, "dist", "css");
const SHELL_HEIGHT = 600;

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
        "run `npm run build` first."
    );
  }
  return fs
    .readdirSync(DIST_CSS)
    .filter((f) => f.endsWith(".css"))
    .map((f) => fs.readFileSync(path.join(DIST_CSS, f), "utf8"))
    .join("\n");
}

function fixture({ layout, container }, css, pageStyle) {
  const rows = Array.from({ length: 60 }, (_, i) => `<p>row ${i}</p>`).join("");
  return `<!doctype html><html><head><style>
    html, body { margin: 0; height: ${SHELL_HEIGHT}px; }
    ${css}
  </style></head><body>
    <div class="${layout}">
      <div class="${container}">
        <div id="page" class="h-100" style="${pageStyle}">
          ${rows}
          <section id="last">last section</section>
        </div>
      </div>
    </div>
  </body></html>`;
}

async function lastChildIsReachable(page) {
  return page.locator("#last").evaluate((el) => {
    const shell = el.closest("#page").parentElement.getBoundingClientRect();
    const own = el.getBoundingClientRect();
    return own.top >= shell.top - 1 && own.bottom <= shell.bottom + 1;
  });
}

test.describe("layout contract: the shell clips, so a page scrolls itself", () => {
  test("a page that sets no overflow of its own has unreachable content", async ({ page }) => {
    await page.setContent(fixture(shellFromAppVue(), compiledCss(), "height: 100%;"));

    const metrics = await page.locator("#page").evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      containerOverflowY: getComputedStyle(el.parentElement).overflowY,
      // A box with `overflow: visible` is not a scroll container at all, so this
      // stays at 0 however far you ask it to go.
      ownScrollTop: (() => {
        el.scrollTop = el.scrollHeight;
        return el.scrollTop;
      })(),
    }));

    // The shell clips rather than scrolling to rescue the page. This is read off
    // the compiled stylesheet, so it fails if that ever stops being true.
    expect(metrics.containerOverflowY).toBe("hidden");
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    expect(metrics.ownScrollTop).toBe(0);
    expect(await lastChildIsReachable(page)).toBe(false);
  });

  test("the same page with overflow-y:auto scrolls and its last child is reachable", async ({
    page,
  }) => {
    await page.setContent(
      fixture(shellFromAppVue(), compiledCss(), "height: 100%; overflow-y: auto;")
    );

    const box = await page.locator("#page").evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    // The page must report content it cannot show at once. Equal heights mean it
    // grew to content height instead of scrolling, which is the bug.
    expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);

    const scrolled = await page.locator("#page").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      return el.scrollTop;
    });
    expect(scrolled).toBeGreaterThan(0);
    expect(await lastChildIsReachable(page)).toBe(true);
  });
});
