// Plan 50: the translator calls behind the shared TranslateDialog stay what the three old dialogs sent.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api/pim/translator", () => ({
  POST_TranslateEstimate: vi.fn(),
  POST_TranslateExecute: vi.fn(),
}));
vi.mock("@/api/contentDB/translator", () => ({
  POST_ContentTranslateEstimate: vi.fn(),
  POST_ContentTranslateExecute: vi.fn(),
}));

import { POST_TranslateEstimate, POST_TranslateExecute } from "@/api/pim/translator";
import { POST_ContentTranslateEstimate, POST_ContentTranslateExecute } from "@/api/contentDB/translator";
import { productTranslateFns, storeTranslateFns } from "@/views/Pim/translateFns";
import { contentTranslateFns } from "@/views/Builder/translateFns";

const request = { source_language: "pl", target_languages: ["en"], force: true };
const jobs = (n) => ({ data: { job_ids: Array.from({ length: n }, (_, i) => i) } });

beforeEach(() => vi.clearAllMocks());

describe("Pim product scope", () => {
  it("estimates and executes the picked products", async () => {
    POST_TranslateEstimate.mockResolvedValue({ data: { estimated_cost_usd: 1 } });
    POST_TranslateExecute.mockResolvedValue(jobs(3));
    const fns = productTranslateFns("ch1", [7, 8]);

    expect(await fns.estimateFn(request)).toEqual({ estimated_cost_usd: 1 });
    expect(await fns.submitFn(request)).toBe(3);
    const payload = { ...request, entity_ids: [7, 8] };
    expect(POST_TranslateEstimate).toHaveBeenCalledWith("ch1", "product", payload);
    expect(POST_TranslateExecute).toHaveBeenCalledWith("ch1", "product", payload);
  });
});

describe("Pim product scope without a pick", () => {
  it("sends nothing: an empty entity_ids would translate the whole channel", async () => {
    const fns = productTranslateFns("ch1", []);

    await expect(fns.estimateFn(request)).rejects.toThrow();
    await expect(fns.submitFn(request)).rejects.toThrow();
    expect(POST_TranslateEstimate).not.toHaveBeenCalled();
    expect(POST_TranslateExecute).not.toHaveBeenCalled();
  });
});

describe("Pim store scope", () => {
  it("estimates each content type without the type list in the payload", async () => {
    POST_TranslateEstimate.mockImplementation((_, type) => Promise.resolve({ data: { entity_type: type } }));
    const fns = storeTranslateFns("ch1");

    const estimates = await fns.estimateFn({ ...request, entity_types: ["product", "feature"] });
    expect(estimates).toEqual([{ entity_type: "product" }, { entity_type: "feature" }]);
    expect(POST_TranslateEstimate.mock.calls).toEqual([["ch1", "product", request], ["ch1", "feature", request]]);
    expect(POST_TranslateEstimate.mock.calls.every(([, , payload]) => !("entity_ids" in payload))).toBe(true);
  });

  it("executes only the types with items and counts every job", async () => {
    POST_TranslateExecute.mockResolvedValueOnce(jobs(2)).mockResolvedValueOnce(jobs(1));
    const estimates = [
      { entity_type: "product", estimated_items: 5 },
      { entity_type: "category", estimated_items: 0 },
      { entity_type: "attribute", estimated_items: 1 },
    ];

    expect(await storeTranslateFns("ch1").submitFn({ ...request, entity_types: ["x"] }, estimates)).toBe(3);
    expect(POST_TranslateExecute.mock.calls).toEqual([["ch1", "product", request], ["ch1", "attribute", request]]);
  });
});

describe("Pages content scope", () => {
  it("sends every page of the channel", async () => {
    POST_ContentTranslateEstimate.mockResolvedValue({ data: { per_draft: [] } });
    POST_ContentTranslateExecute.mockResolvedValue(jobs(4));
    const fns = contentTranslateFns("web");
    const content = { ...request, publish: true };

    expect(await fns.estimateFn(content)).toEqual({ per_draft: [] });
    expect(await fns.submitFn(content)).toBe(4);
    expect(POST_ContentTranslateEstimate).toHaveBeenCalledWith("web", { entity_type: "page", ...content });
    expect(POST_ContentTranslateExecute).toHaveBeenCalledWith("web", { entity_type: "page", ...content });
  });
});
