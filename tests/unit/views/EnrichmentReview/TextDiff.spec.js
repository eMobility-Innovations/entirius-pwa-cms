// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TextDiff from "@/views/EnrichmentReview/TextDiff.vue";

const SegmentedControl = { name: "SegmentedControl", props: ["options", "modelValue"], template: "<div />" };
const render = (props) =>
  mount(TextDiff, { props, global: { stubs: { SegmentedControl, ReadonlyOff: { template: "<div><slot /></div>" } } } });
const content = (w) => w.find("[data-testid='text-diff-content']");

describe("TextDiff", () => {
  it("new content: the text alone, no view switch and no before", () => {
    const w = render({ before: "<p></p>", after: "<p>Fresh <b>copy</b></p>" });
    expect(w.find("[data-testid='text-diff-new']").exists()).toBe(true);
    expect(w.findComponent(SegmentedControl).exists()).toBe(false);
    expect(content(w).html()).toContain("<p>Fresh <b>copy</b></p>");
  });

  it("plain text: one flow of the changes by default", () => {
    const w = render({ before: "A plain chair", after: "A solid oak chair" });
    expect(w.findAll("del").map((n) => n.text())).toEqual(["plain"]);
    expect(w.findAll("mark").map((n) => n.text())).toEqual(["solid oak"]);
    expect(w.findComponent(SegmentedControl).props("options").map((o) => o.value)).toEqual(["changes", "before", "after"]);
  });

  it("HTML: changes render sanitised, Before / After show each text, side by side only when wide", async () => {
    const w = render({ before: "<p>Old</p>", after: '<p onclick="x()">New<script>alert(1)</script></p>' });
    expect(content(w).html()).not.toContain("script");
    expect(content(w).html()).not.toContain("onclick");
    await w.setData({ view: "before" });
    expect(content(w).text()).toBe("Old");
    await w.setData({ view: "after" });
    expect(content(w).html()).toContain("<p>New</p>");
    expect(w.findComponent(SegmentedControl).props("options")).toHaveLength(3);

    const wide = render({ before: "<p>Old</p>", after: "<p>New</p>", wide: true });
    expect(wide.findComponent(SegmentedControl).props("options").map((o) => o.value)).toContain("split");
  });

  it("plain text is escaped, never markup", async () => {
    const w = render({ before: "x", after: "<script>alert(1)</script> plain" });
    expect(w.find("script").exists()).toBe(false);
  });

  it("a long text is capped behind Show more", async () => {
    const w = render({ before: "", after: "word ".repeat(400) });
    expect(w.find(".text-diff__body--capped").exists()).toBe(true);
    await w.find("[data-testid='text-diff-more']").trigger("click");
    expect(w.find(".text-diff__body--capped").exists()).toBe(false);
  });

  it("rules add a counter and snippet a search preview of the proposed text", () => {
    const w = render({
      before: "",
      after: "x".repeat(140),
      rules: { min: 120, max: 155, snippet: true },
      snippet: { title: "Orion Sofa", url: "/orion-sofa" },
    });
    expect(w.findComponent({ name: "LengthCounter" }).props("length")).toBe(140);
    const snippet = w.findComponent({ name: "SearchSnippet" });
    expect(snippet.props()).toMatchObject({ title: "Orion Sofa", url: "/orion-sofa" });
  });
});
