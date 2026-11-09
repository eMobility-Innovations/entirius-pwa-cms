import { beforeEach, describe, expect, it, vi } from "vitest";

const enrichmentApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api/enrichment/client", () => ({ enrichmentApi }));

import { getReviewProduct, sendBack, getMissing, fillMissing } from "@/api/integrator/review";

beforeEach(() => vi.clearAllMocks());

describe("integrator review API", () => {
  it("gets the product review using the authenticated enrichment client", async () => {
    const response = { data: { sku: "A/B", rounds_used: 1 } };
    enrichmentApi.get.mockResolvedValueOnce(response);
    expect(await getReviewProduct("A/B")).toBe(response);
    expect(enrichmentApi.get).toHaveBeenCalledWith("/api/integrator/v1/review/product/A%2FB/");
  });

  it("sends a product back with an optional reason", async () => {
    const response = { data: { n: 1, state: "waiting_ai" } };
    enrichmentApi.post.mockResolvedValueOnce(response);
    const body = { sku: "SKU-1", reason: "Check the weight" };
    expect(await sendBack(body)).toBe(response);
    expect(enrichmentApi.post).toHaveBeenCalledWith("/api/integrator/v1/review/send-back/", body);
    await sendBack({ sku: "SKU-1" });
    expect(enrichmentApi.post).toHaveBeenLastCalledWith("/api/integrator/v1/review/send-back/", { sku: "SKU-1" });
  });

  it("gets missing attributes for the encoded SKU", async () => {
    const response = { data: [{ feature_idx: "weight", kind: "number" }] };
    enrichmentApi.get.mockResolvedValueOnce(response);
    expect(await getMissing("A/B")).toBe(response);
    expect(enrichmentApi.get).toHaveBeenCalledWith("/api/integrator/v1/review/missing/A%2FB/");
  });

  it("fills one missing attribute with the contract body", async () => {
    const response = { data: { id: 42 } };
    enrichmentApi.post.mockResolvedValueOnce(response);
    const body = { sku: "SKU-1", feature_idx: "weight", value: "12" };
    expect(await fillMissing(body)).toBe(response);
    expect(enrichmentApi.post).toHaveBeenCalledWith("/api/integrator/v1/review/fill/", body);
  });
});
