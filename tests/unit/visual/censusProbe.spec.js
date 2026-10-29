import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";

const SCALE = { radius: [], fontSize: [] };
// No colour token is passed, so every sampled background is off-token.
const censusBackgrounds = () =>
  window.visualProbes.census([], SCALE).offToken.filter((row) => row.property === "background-color").map((row) => row.value);

function swatch(attrs = {}) {
  const el = document.body.appendChild(document.createElement("div"));
  el.style.backgroundColor = "#123456";
  el.style.opacity = "1"; // happy-dom computes no default opacity; the probe skips an invisible element
  Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
  return el;
}

describe("census probe: inline backgrounds", () => {
  beforeAll(() => {
    window.eval(readFileSync(resolve(__dirname, "../../visual/support/probes.browser.js"), "utf8"));
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function visibleBoxes() {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 10, height: 10 });
  }

  it("measures a script-bound raw colour", () => {
    const el = swatch();
    visibleBoxes();
    expect(censusBackgrounds()).toContain(getComputedStyle(el).backgroundColor);
  });

  it("skips a data carrier marked data-census=data", () => {
    const el = swatch({ "data-census": "data" });
    visibleBoxes();
    expect(censusBackgrounds()).not.toContain(getComputedStyle(el).backgroundColor);
  });
});
