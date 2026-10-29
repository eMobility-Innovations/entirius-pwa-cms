import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import fs from "fs";
import path from "path";
import { safeHref } from "@/utils/safeHref";
import ProductCard from "@/views/Atlas/Review/ProductCard.vue";

// A URL the server hands over (a supplier's product page, a meeting link, a subject or fix URL) is data somebody
// else wrote: bound to `href` as it is, `javascript:…` would run in the staff session on a click.
const SRC = path.resolve(__dirname, "../../../src");
// Media and file links: built from the API origin, which a deployment may set as a path.
const OWN_ORIGIN = ["views/Pim/components/MediaGallery.vue", "views/Pim/components/ProductFiles.vue"];

const vueFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return vueFiles(full);
    return entry.name.endsWith(".vue") ? [full] : [];
  });
const sources = () => vueFiles(SRC).map((file) => ({ file: path.relative(SRC, file), text: fs.readFileSync(file, "utf8") }));

describe("safeHref", () => {
  it("returns http, https and mailto URLs", () => {
    for (const url of ["https://supplier.test/p/1", "http://supplier.test/p/1", "HTTPS://supplier.test", "mailto:office@shop.test"]) {
      expect(safeHref(url)).toBe(url);
    }
    expect(safeHref("  https://supplier.test/p/1 ")).toBe("https://supplier.test/p/1");
  });

  it("returns undefined for anything else", () => {
    const refused = ["javascript:alert(1)", " JavaScript:alert(1)", "java\tscript:alert(1)", "data:text/html,x", "vbscript:x", "//supplier.test", "/path", "", null, undefined, 7];
    for (const url of refused) expect(safeHref(url)).toBeUndefined();
  });

  it("a supplier link with a javascript: URL renders without href", () => {
    const card = (url) =>
      mount(ProductCard, { props: { product: { url } }, global: { stubs: { ConfidenceBadge: true } } }).get(
        '[data-testid="product-card-supplier-url"]'
      );
    expect(card("javascript:alert(document.cookie)").attributes("href")).toBeUndefined();
    expect(card("https://supplier.test/p/1").attributes("href")).toBe("https://supplier.test/p/1");
  });
});

describe("links built from server data", () => {
  it("every bound href goes through safeHref", () => {
    const unsafe = sources()
      .filter(({ file }) => !OWN_ORIGIN.includes(file))
      .flatMap(({ file, text }) => text.split("\n").filter((line) => line.includes(':href="') && !line.includes(':href="safeHref(')).map((line) => `${file}: ${line.trim()}`));
    expect(unsafe).toEqual([]);
  });

  it("every link that opens a new tab carries rel noopener noreferrer", () => {
    const open = sources().flatMap(({ file, text }) =>
      (text.match(/<a\b[^>]*target="_blank"[^>]*>/g) || []).filter((tag) => !tag.includes('rel="noopener noreferrer"')).map((tag) => `${file}: ${tag.replace(/\s+/g, " ")}`)
    );
    expect(open).toEqual([]);
  });
});
