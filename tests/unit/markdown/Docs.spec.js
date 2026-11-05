// @vitest-environment jsdom
// Docs view: the two bundled .md files (webpack `raw-loader`) through `marked(…)` with global
// `marked.setOptions({ gfm: true, breaks: true })`, then `v-html` WITHOUT sanitizeHtml (build-time content only,
// see tests/unit/audit/vHtml.spec.js). vitest.config.js maps the `!!raw-loader!` specifier to Vite's `?raw`; the specs
// replace the loaded text with the corpus through setData.
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import fs from "fs";
import path from "path";
import { marked } from "marked";

import Docs from "@/views/Docs/index.vue";
import { CASES, FULL } from "../fixtures/markdown/corpus";
import { expectRenderedCorpus } from "./helpers";

const real = (name) => fs.readFileSync(path.resolve(__dirname, "../../../src/views/Docs", name), "utf8");
const stubs = { PageLayout: { template: "<div><slot name='header' /><slot /></div>" }, PageHeader: true, BasicTabs: true, BasicSelect: true, BasicCard: true, ReadonlyOff: { template: "<div><slot /></div>" } };

async function rendered(md, doc = "config_docs") {
  const w = mount(Docs, { global: { stubs } });
  await w.setData({ config_docs: md, props_docs: md, doc_prev: doc });
  return w.find(".markdown-renderer-wrapper > div");
}

describe("Docs renders markdown", () => {
  it("shows the corpus as the expected elements", async () => {
    const root = (await rendered(FULL)).element;
    expectRenderedCorpus(root, { keepsListStart: true });
  });

  it("keeps the HTML of every case in one file snapshot", async () => {
    const html = [];
    for (const [name, md] of Object.entries(CASES)) html.push(`<!-- ${name} -->\n${(await rendered(md)).element.innerHTML}`);
    await expect(html.join("\n\n")).toMatchFileSnapshot("./__snapshots__/Docs.html");
  });

  it("turns single newlines into <br> (breaks: true)", async () => {
    const el = (await rendered(CASES.paragraphs)).element;
    expect(el.querySelectorAll("p")[0].innerHTML).toBe("First paragraph<br>second line of it");
  });

  it("keeps table alignment and heading ids (no sanitiser)", async () => {
    const el = (await rendered(`${CASES.headings}\n\n${CASES.table}`)).element;
    expect(el.querySelector("h2").getAttribute("id")).toBe("section-two");
    expect(el.querySelector("th").getAttribute("align")).toBe("left");
  });

  it("renders the bundled config_docs.md and props_docs.md", async () => {
    const config = (await rendered(real("config_docs.md"), "config_docs")).element;
    const props = (await rendered(real("props_docs.md"), "props_docs")).element;
    await expect(config.innerHTML).toMatchFileSnapshot("./__snapshots__/Docs.config_docs.html");
    await expect(props.innerHTML).toMatchFileSnapshot("./__snapshots__/Docs.props_docs.html");
    expect(config.querySelectorAll("table")).toHaveLength(4);
  });

  it("renders an empty document as nothing", async () => {
    expect((await rendered("")).element.innerHTML).toBe("");
  });

  // Documented gap, not a fix: raw HTML in the .md passes through unchanged. Safe only because the files ship with
  // the build; the audit spec keeps API data off this path.
  it("passes raw HTML through unsanitised (build-time files only)", async () => {
    const el = (await rendered(`${CASES.html_script}\n\n${CASES.html_onerror}\n\n${CASES.link_javascript}`)).element;
    expect(el.querySelector("script")).not.toBeNull();
    expect(el.querySelector("[onerror]")).not.toBeNull();
    expect(el.querySelector("a[href^='javascript:']")).not.toBeNull();
  });

  it("leaves breaks: true as the global marked default once the view rendered", async () => {
    await rendered("x");
    expect(marked.parse("a\nb")).toContain("<br>");
  });
});
