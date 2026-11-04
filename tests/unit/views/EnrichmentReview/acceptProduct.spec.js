import { describe, it, expect, vi, beforeEach } from "vitest";

const mockList = vi.fn();
const mockAccept = vi.fn();
vi.mock("@/api/enrichment/api", () => ({
  GET_Proposals: (...a) => mockList(...a),
  POST_AcceptProposal: (...a) => mockAccept(...a),
}));

import { acceptProduct } from "@/views/EnrichmentReview/acceptProduct";

const attribute = (id) => ({ id, target_kind: "attribute_value" });
const set = (id) => ({ id, target_kind: "feature_set" });

describe("acceptProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccept.mockResolvedValue({ data: { status: "applied" } });
  });

  it("reads the product's pending proposals fresh", async () => {
    mockList.mockResolvedValue({ data: { results: [] } });

    await acceptProduct("SKU-1");

    expect(mockList).toHaveBeenCalledWith({ subject_ref: "SKU-1", status: "pending", page_size: 100 });
  });

  it("applies the feature set before its attributes", async () => {
    mockList.mockResolvedValue({ data: { results: [attribute(1), set(2), attribute(3)] } });

    const result = await acceptProduct("SKU-1");

    expect(mockAccept.mock.calls.map(([id]) => id)).toEqual([2, 1, 3]);
    expect(result).toEqual({ accepted: 3, drifted: null });
  });

  it("stops at a drifted proposal and reports it", async () => {
    mockList.mockResolvedValue({ data: { results: [set(1), attribute(2), attribute(3)] } });
    const drifted = { id: 2, status: "drifted" };
    mockAccept.mockResolvedValueOnce({ data: { status: "applied" } }).mockResolvedValueOnce({ data: drifted });

    const result = await acceptProduct("SKU-1");

    expect(mockAccept).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ accepted: 1, drifted });
  });

  it("never applies an attribute after the set failed", async () => {
    mockList.mockResolvedValue({ data: { results: [set(1), attribute(2)] } });
    mockAccept.mockRejectedValueOnce(new Error("refused"));

    await expect(acceptProduct("SKU-1")).rejects.toThrow("refused");

    expect(mockAccept).toHaveBeenCalledTimes(1);
  });
});
