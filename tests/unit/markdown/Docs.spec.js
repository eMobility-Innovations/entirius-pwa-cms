// @vitest-environment jsdom
// Docs view: the two bundled .md files (webpack `raw-loader`) through `marked(…)` with global
// own `Marked({ gfm: true, breaks: true })` instance, then `v-html` through sanitizeHtml like every other sink
// (tests/unit/audit/vHtml.spec.js). vitest.config.js maps the `!!raw-loader!` specifier to Vite's `?raw`; the specs
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
    expectRenderedCorpus(root);
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

  // marked 18 no longer emits heading ids (headerIds was removed in v8; the Docs .md files link to no anchors).
  it("keeps table alignment through the sanitiser; headings carry no id since marked 18", async () => {
    const el = (await rendered(`${CASES.headings}\n\n${CASES.table}`)).element;
    expect(el.querySelector("h2").getAttribute("id")).toBeNull();
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

  it("cleans raw HTML with the sanitiser, like every other markdown view", async () => {
    const el = (await rendered(`${CASES.html_script}\n\n${CASES.html_onerror}\n\n${CASES.link_javascript}`)).element;
    expect(el.querySelector("script")).toBeNull();
    expect(el.querySelector("[onerror]")).toBeNull();
    expect(el.querySelector("a[href^='javascript:']")).toBeNull();
  });

  it("does not leak breaks: true into the global marked defaults (own Marked instance)", async () => {
    const before = marked.parse("a\nb");
    expect(before).not.toContain("<br>");
    const el = (await rendered("a\nb")).element;
    expect(el.querySelector("p").innerHTML).toBe("a<br>b");
    expect(marked.parse("a\nb")).toBe(before);
    expect(marked.getDefaults().breaks).toBe(false);
  });
});
