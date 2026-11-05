// @vitest-environment jsdom
// MarkdownField (enrichment profile): `marked.parse` with default options, then `sanitizeHtml`, then `v-html`.
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Docs from "@/views/Docs/index.vue";
import MarkdownField from "@/views/EnrichmentProfile/MarkdownField.vue";
import { CASES, EMPTY, FULL, HOSTILE } from "../fixtures/markdown/corpus";
import { expectRenderedCorpus, unsafeIn } from "./helpers";

const stubs = { ReadonlyOff: { template: "<div><slot /></div>" }, SegmentedControl: true, BasicTextarea: true };

async function preview(modelValue) {
  const w = mount(MarkdownField, { props: { modelValue }, global: { stubs } });
  await w.setData({ view: "preview" });
  return w.find("[data-testid='markdown-field-preview']");
}

describe("MarkdownField preview renders the markdown corpus", () => {
  it("shows the whole corpus as the expected elements", async () => {
    expectRenderedCorpus((await preview(FULL)).element);
  });

  it("keeps the HTML of every case in one file snapshot", async () => {
    const html = [];
    for (const [name, md] of Object.entries(CASES)) html.push(`<!-- ${name} -->\n${(await preview(md)).element.innerHTML}`);
    await expect(html.join("\n\n")).toMatchFileSnapshot("./__snapshots__/MarkdownField.html");
  });

  it("drops what the sanitiser does not allow (heading ids, task checkboxes), keeps the text", async () => {
    const el = (await preview(`${CASES.headings}\n\n${CASES.tasks}`)).element;
    expect(el.querySelector("h1").getAttribute("id")).toBeNull();
    expect(el.querySelector("input")).toBeNull();
    expect(el.textContent).toContain("done");
  });

  it("does not turn single newlines into <br> (default options)", async () => {
    const el = (await preview(CASES.paragraphs)).element;
    expect(el.querySelectorAll("p")[0].innerHTML).toBe("First paragraph\nsecond line of it");
    expect(el.querySelectorAll("p")[1].querySelectorAll("br")).toHaveLength(1);
  });

  it.each(EMPTY.map((v) => [String(v), v]))("renders %s as an empty preview", async (_, value) => {
    expect((await preview(value)).element.innerHTML).toBe("");
  });

  it.each(HOSTILE)("lets no active content of %s reach the DOM", async (name) => {
    expect(unsafeIn((await preview(CASES[name])).element)).toEqual([]);
  });

  it("drops script and onerror but keeps the text around them", async () => {
    const el = (await preview(`${CASES.html_script}\n\n${CASES.html_onerror}`)).element;
    expect(el.textContent).toContain("before");
    expect(el.textContent).toContain("after");
    expect(el.textContent).not.toContain("alert('xss')");
  });

  it("keeps the link text of a javascript: link without a href", async () => {
    const link = [...(await preview(CASES.link_javascript)).element.querySelectorAll("a")].find((a) => a.textContent === "click");
    expect(link?.getAttribute("href") ?? null).toBeNull();
  });

  it("keeps the rendered corpus free of unsafe markup as a whole", async () => {
    expect(unsafeIn((await preview(FULL)).element)).toEqual([]);
  });

  // Docs used to call the global marked.setOptions({ breaks: true }); T2 finding 2. Docs now has its own instance.
  it("keeps default options after the Docs view was opened and rendered", async () => {
    const docsStubs = { PageLayout: { template: "<div><slot name='header' /><slot /></div>" }, PageHeader: true, BasicTabs: true, BasicSelect: true, BasicCard: true, ReadonlyOff: { template: "<div><slot /></div>" } };
    const docs = mount(Docs, { global: { stubs: docsStubs } });
    await docs.setData({ config_docs: CASES.paragraphs, doc_prev: "config_docs" });
    expect(docs.find(".markdown-renderer-wrapper > div").element.querySelectorAll("p")[0].innerHTML).toContain("<br>");

    const el = (await preview(CASES.paragraphs)).element;
    expect(el.querySelectorAll("p")[0].innerHTML).toBe("First paragraph\nsecond line of it");
  });
});
