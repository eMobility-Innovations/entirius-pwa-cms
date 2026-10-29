import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";

// A box glued to the bottom of the viewport, as wide as it: `height` decides bar (≤ 30 %) or layer.
const bottomBox = (height) => ({
  x: 0, y: innerHeight - height, left: 0, top: innerHeight - height, right: innerWidth, bottom: innerHeight,
  width: innerWidth, height,
});

function mount(html) {
  document.body.innerHTML = html;
  const boxes = new Map([...document.querySelectorAll("[data-h]")].map((el) => [el, bottomBox(Number(el.dataset.h))]));
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function box() {
    return boxes.get(this) || bottomBox(0);
  });
}

const bottomBar = () => window.uxProbes.measure({ viewportWidth: innerWidth, mobile: true }).bottomBar;

describe("@ux probe: bottom bar", () => {
  beforeAll(() => {
    window.eval(readFileSync(resolve(__dirname, "../../visual/support/ux.browser.js"), "utf8"));
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("finds a sticky bar inside a full-screen phone dialog", () => {
    mount(`<div role="dialog" style="position: fixed" data-h="${innerHeight}">
      <div class="dialog-actions" style="position: sticky" data-h="60"></div></div>`);
    expect(bottomBar()).toContain("dialog-actions");
  });

  it("never takes the dialog layer or the BasicMenu bottom sheet for a bar", () => {
    mount(`<div role="dialog" class="basic-menu__popover--bottom" style="position: fixed" data-h="120"></div>
      <div class="basic-menu__popover--bottom" style="position: fixed" data-h="120"></div>`);
    expect(bottomBar()).toBeNull();
  });
});
