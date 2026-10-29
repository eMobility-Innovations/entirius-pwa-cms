import { describe, it, expect } from "vitest";
import {
  newTemplateBody,
  nextPosition,
  parseRules,
  templateKey,
  templateParams,
} from "@/views/Pim/components/enrichment/templateForm";

describe("templateForm", () => {
  it("makes a key from the name: ascii, lowercase, dashes, unique", () => {
    expect(templateKey("Meta opisy")).toBe("meta-opisy");
    expect(templateKey("Żółta łódź!")).toBe("zolta-lodz");
    expect(templateKey("  ")).toBe("template");
    expect(templateKey("Meta opisy", ["meta-opisy", "meta-opisy-2"])).toBe("meta-opisy-3");
    expect(templateKey("x".repeat(100)).length).toBeLessThanOrEqual(64);
  });

  it("puts a new template after the last one", () => {
    expect(nextPosition([])).toBe(10);
    expect(nextPosition([{ position: 30 }, { position: 10 }])).toBe(40);
  });

  it("a template serves every channel: the run's channel is left out", () => {
    expect(templateParams({ channel: "eu", fields: ["a"] })).toEqual({ fields: ["a"] });
  });

  it("rules are typed one per line", () => {
    expect(parseRules(" Brand first. \n\n No prices.\n")).toEqual(["Brand first.", "No prices."]);
    expect(parseRules("")).toEqual([]);
  });

  it("the body of Save as template", () => {
    const body = newTemplateBody({
      label: " Short meta ",
      worker: { key: "pim.writer" },
      params: { channel: "eu", fields: ["meta_title"], languages: ["*"] },
      rules: ["Brand name first."],
      templates: [{ key: "short-meta", position: 10 }],
    });
    expect(body).toEqual({
      key: "short-meta-2",
      label: "Short meta",
      worker_key: "pim.writer",
      params: { fields: ["meta_title"], languages: ["*"] },
      rules: ["Brand name first."],
      position: 20,
      active: true,
    });
  });

  it("a template made from scratch has no rules", () => {
    expect(newTemplateBody({ label: "X", worker: { key: "w" }, params: {} }).rules).toEqual([]);
  });
});
