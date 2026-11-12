import { describe, it, expect, vi, beforeEach } from "vitest";

const mockList = vi.fn();
const mockAccept = vi.fn();
vi.mock("@/api/enrichment/api", () => ({
  GET_Proposals: (...a) => mockList(...a),
  POST_AcceptProposal: (...a) => mockAccept(...a),
}));

import { acceptProduct, isDecidedElsewhere } from "@/views/EnrichmentReview/acceptProduct";

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


describe("isDecidedElsewhere", () => {
  const validation = {
    error: "VALIDATION_ERROR", message: "Request validation failed.", debug_id: "review-conflict",
    details: [{ field: null, location: "body", issue: "INVALID", description: "proposal changed meanwhile: it is accepted now" }],
  };
  const cases = [
    [409, { error: "CONFLICT", message: "Something else entirely" }, true],
    [400, validation, true],
    [400, { error: "INVALID_REQUEST", message: "proposal changed meanwhile" }, false],
    [500, { error: "INTERNAL_ERROR", message: "proposal changed meanwhile" }, false],
    [400, { ...validation, details: [{ description: "Something else entirely" }] }, false],
    [400, { ...validation, details: undefined }, false],
    [400, { ...validation, details: [null, { description: 42 }] }, false],
    [400, { ...validation, details: [{ description: "prefix proposal changed meanwhile" }] }, false],
  ];
  it.each(cases)("classifies raw HTTP %s with body %j as %s", (status, data, expected) => {
    expect(isDecidedElsewhere({ response: { status, data } })).toBe(expected);
  });
  it.each(cases)("classifies unwrapped HTTP %s with body %j as %s", (httpStatus, data, expected) => {
    const error = { ...data };
    Object.defineProperty(error, "httpStatus", { value: httpStatus });
    expect(isDecidedElsewhere(error)).toBe(expected);
  });
});
